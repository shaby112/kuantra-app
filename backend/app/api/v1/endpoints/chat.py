"""
Chat endpoints with conversation history support.
"""
import asyncio
import json
import re
from uuid import UUID
from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from sqlalchemy import text, select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.api.deps import get_current_user
from app.core.logging import logger
from app.core.config import settings
from app.db.models import User, Conversation, ChatMessage, DbConnection
from app.services.connection_service import connection_service, QueryTimeoutError
from app.core.rate_limit import limiter

router = APIRouter()


def _build_schema_context() -> str:
    """
    Query DuckDB information_schema for all synced tables/columns.
    Returns a compact text summary suitable for an LLM system prompt.
    """
    from app.services.duckdb_manager import duckdb_manager

    try:
        tables = duckdb_manager.execute(
            "SELECT table_schema, table_name "
            "FROM information_schema.tables "
            "WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'main') "
            "AND table_name NOT LIKE '_dlt_%' "
            "ORDER BY table_schema, table_name"
        )
        if not tables:
            return "No synced data sources are available yet."

        columns = duckdb_manager.execute(
            "SELECT table_schema, table_name, column_name, data_type "
            "FROM information_schema.columns "
            "WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'main') "
            "AND table_name NOT LIKE '_dlt_%' "
            "ORDER BY table_schema, table_name, ordinal_position"
        )

        # Group columns by schema.table
        col_map: Dict[str, List[str]] = {}
        for c in columns:
            key = f'{c["table_schema"]}.{c["table_name"]}'
            col_map.setdefault(key, []).append(f'  - {c["column_name"]} ({c["data_type"]})')

        lines = ["Available tables in the DuckDB warehouse:\n"]
        for t in tables:
            schema = t["table_schema"]
            tname = t["table_name"]
            fqn = f'"{schema}"."{tname}"'
            lines.append(f"Table: {fqn}")
            col_key = f"{schema}.{tname}"
            if col_key in col_map:
                lines.append("  Columns:")
                lines.extend(col_map[col_key])
            lines.append("")

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Failed to build schema context: {e}")
        return "Schema context unavailable."


SYSTEM_PROMPT_TEMPLATE = """You are Kuantra AI, a business intelligence assistant. You help users analyze their data by answering questions and generating SQL queries.

## Data Context
All data is stored in a DuckDB warehouse. Use DuckDB SQL syntax (it is PostgreSQL-compatible with extensions).

{schema_context}

## Rules
1. ALWAYS use fully schema-qualified table names: "schema_name"."table_name" (with double quotes).
2. NEVER use unqualified table names like just "customers" — always include the schema.
3. Column names should also be double-quoted if they contain special characters, but simple names are fine unquoted.
4. DuckDB supports standard SQL: SELECT, JOIN, GROUP BY, window functions, CTEs, etc.
5. When generating SQL, wrap it in a ```sql code block.
6. If the user asks a greeting or non-data question, respond conversationally WITHOUT generating SQL.
7. If the user's question is ambiguous (e.g., multiple tables could match), ask which data source they mean.
8. Keep explanations concise. Focus on the SQL and the insight.
9. For date/time operations, use DuckDB functions (e.g., date_trunc, current_date, interval).
10. Always use LIMIT when the user doesn't specify a row count (default LIMIT 100)."""


class ChatRequest(BaseModel):
    message: str
    connection_id: Optional[UUID] = None


class ExecuteRequest(BaseModel):
    sql: str
    connection_id: Optional[UUID] = None


class ExecuteResponse(BaseModel):
    results: List[Any]


@router.post("/execute", response_model=ExecuteResponse)
@limiter.limit(settings.RATE_LIMIT_QUERY_EXECUTE)
async def execute_query_endpoint(
    request: Request,
    body: ExecuteRequest,
    current_user: User = Depends(get_current_user)
):
    """Execute a SQL query against the DuckDB warehouse."""
    from app.services.duckdb_manager import duckdb_manager

    try:
        if not connection_service.is_safe_query(body.sql):
            raise HTTPException(
                status_code=400,
                detail={"code": "READ_ONLY_ENFORCED", "message": "Only read-only SELECT queries are allowed."},
            )

        # Always execute against DuckDB warehouse — this is where all synced data lives
        results = duckdb_manager.execute(body.sql)
        return {"results": results}
    except QueryTimeoutError as e:
        logger.warning(f"Query timeout: {e}")
        raise HTTPException(
            status_code=408,
            detail={"code": "QUERY_TIMEOUT", "message": str(e)},
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=408,
            detail={
                "code": "QUERY_TIMEOUT",
                "message": f"Query timed out after {settings.EXTERNAL_QUERY_TIMEOUT_SECONDS}s",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Execution Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stream")
@limiter.limit(settings.RATE_LIMIT_CHAT_STREAM)
async def chat_stream(
    request: Request,
    query: str,
    conversation_id: Optional[UUID] = None,
    connection_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user)
):
    """
    SSE endpoint for real-time AI analysis with conversation history.
    """
    logger.info(f"Stream requested by user {current_user.id} (username: {current_user.username})")

    async def event_generator():
        try:
            # Get or create conversation
            async with AsyncSessionLocal() as db:
                conv = None
                if conversation_id:
                    result = await db.execute(
                        select(Conversation)
                        .options(selectinload(Conversation.messages))
                        .where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
                    )
                    conv = result.scalar_one_or_none()

                if not conv:
                    # Create new conversation
                    conv = Conversation(
                        user_id=current_user.id,
                        title=query[:50] + "..." if len(query) > 50 else query
                    )
                    db.add(conv)
                    await db.commit()
                    await db.refresh(conv)
                    logger.info(f"Created new conversation {conv.id}")
                    # Yield the conversation ID to the frontend
                    yield f"data: {json.dumps({'type': 'conversation', 'conversation_id': str(conv.id)})}\n\n"
                    
                    # For new conversation, history is empty
                    history = []

                else:
                    # Build history for context (only for existing conversations)
                    history = []
                    if conv.messages:
                        for msg in conv.messages[-20:]:  # Last 20 messages for context
                            history.append({"role": msg.role, "content": msg.content})

                # Save user message
                user_msg = ChatMessage(
                    conversation_id=conv.id,
                    role="user",
                    content=query
                )
                db.add(user_msg)
                await db.commit()

            # Build schema context for the LLM
            schema_context = _build_schema_context()
            system_prompt = SYSTEM_PROMPT_TEMPLATE.format(schema_context=schema_context)

            # Stream the AI response
            full_response = ""
            sql_generated = None

            from app.services.llm_provider_service import llm_provider_registry

            provider = llm_provider_registry.get_provider()
            try:
                full_response = await provider.generate(
                    prompt=query,
                    system_prompt=system_prompt,
                    history=history if history else None,
                )
            except Exception as llm_exc:
                logger.error(f"LLM provider failed: {llm_exc}")
                full_response = (
                    "AI is temporarily unavailable. Please configure a valid AI key in Settings "
                    "or switch to Local AI and download the model."
                )

            raw = full_response.strip()
            # Extract SQL from markdown code blocks if present
            sql_match = re.search(r"```(?:sql)?\s*\n?([\s\S]*?)```", raw)
            if sql_match:
                sql_generated = sql_match.group(1).strip()
                natural_text = re.sub(r"```(?:sql)?\s*\n?[\s\S]*?```", "", raw).strip()
                if not natural_text:
                    natural_text = f"Here's a query to answer your question:"
            elif raw.upper().lstrip().startswith(("SELECT ", "WITH ", "INSERT ", "UPDATE ", "DELETE ")):
                # The whole response is just a SQL query
                sql_generated = raw
                natural_text = f"Here's a query to answer your question:"
            else:
                natural_text = raw
                sql_generated = None

            yield f"data: {json.dumps({'type': 'text', 'content': natural_text})}\n\n"
            if sql_generated:
                yield f"data: {json.dumps({'type': 'status', 'sql': sql_generated})}\n\n"

            # Save assistant response
            if full_response:
                async with AsyncSessionLocal() as db:
                    assistant_msg = ChatMessage(
                        conversation_id=conv.id,
                        role="assistant",
                        content=natural_text,
                        sql_query=sql_generated
                    )
                    db.add(assistant_msg)
                    # Update conversation timestamp
                    result = await db.execute(
                        select(Conversation).where(Conversation.id == conv.id)
                    )
                    conv_to_update = result.scalar_one_or_none()
                    if conv_to_update:
                        from datetime import datetime
                        conv_to_update.updated_at = datetime.utcnow()
                    await db.commit()

        except Exception as e:
            logger.error(f"SSE Error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
