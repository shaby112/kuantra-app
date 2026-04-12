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
            "WHERE table_schema NOT IN ('information_schema', 'pg_catalog') "
            "AND table_name NOT LIKE '_dlt_%' "
            "AND table_schema NOT LIKE '%_staging' "
            "ORDER BY table_schema, table_name"
        )
        if not tables:
            return "No synced data sources are available yet."

        columns = duckdb_manager.execute(
            "SELECT table_schema, table_name, column_name, data_type "
            "FROM information_schema.columns "
            "WHERE table_schema NOT IN ('information_schema', 'pg_catalog') "
            "AND table_name NOT LIKE '_dlt_%' "
            "AND table_schema NOT LIKE '%_staging' "
            "AND column_name NOT LIKE '_dlt_%' "
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

def _qualify_sql_tables(sql: str) -> str:
    """Best-effort qualification of unqualified table names to "schema"."table"."""
    from app.services.duckdb_manager import duckdb_manager

    try:
        import sqlglot
        from sqlglot import exp
    except Exception:
        return sql

    try:
        table_rows = duckdb_manager.execute(
            "SELECT table_schema, table_name "
            "FROM information_schema.tables "
            "WHERE table_schema NOT IN ('information_schema', 'pg_catalog') "
            "AND table_name NOT LIKE '_dlt_%' "
            "AND table_schema NOT LIKE '%_staging'"
        )
        table_map: Dict[str, List[str]] = {}
        for row in table_rows:
            table_map.setdefault(row["table_name"], []).append(row["table_schema"])

        tree = sqlglot.parse_one(sql, read="duckdb")

        for table in list(tree.find_all(exp.Table)):
            # Already qualified (schema or catalog present)
            if table.db or table.catalog:
                continue
            tname = table.name
            schemas = table_map.get(tname, [])
            if len(schemas) == 1:
                chosen_schema = schemas[0]
            elif len(schemas) > 1:
                non_staging = [s for s in schemas if not s.endswith("_staging")]
                chosen_schema = non_staging[0] if len(non_staging) == 1 else None
            else:
                chosen_schema = None

            if chosen_schema:
                table.set("db", exp.Identifier(this=chosen_schema, quoted=True))
                table.set("this", exp.Identifier(this=tname, quoted=True))

        return tree.sql(dialect="duckdb")
    except Exception:
        return sql


def _execute_with_qualified_fallback(sql: str):
    """Execute SQL and retry once with auto-qualified table names on missing-table errors."""
    from app.services.duckdb_manager import duckdb_manager

    try:
        return duckdb_manager.execute(sql)
    except Exception as e:
        msg = str(e)
        if "Catalog Error: Table with name" not in msg:
            raise

        qualified_sql = _qualify_sql_tables(sql)
        if qualified_sql.strip() == sql.strip():
            raise

        logger.info("Retrying query with auto-qualified table names")
        return duckdb_manager.execute(qualified_sql)


def _is_repairable_sql_error(error_message: str) -> bool:
    msg = (error_message or "").lower()
    repair_markers = [
        "binder error",
        "parser error",
        "catalog error",
        "referenced column",
        "table with name",
        "no function matches",
        "column \"",
        "syntax error",
    ]
    return any(marker in msg for marker in repair_markers)


async def _repair_sql_with_llm(original_sql: str, error_message: str) -> Optional[str]:
    from app.services.llm_provider_service import llm_provider_registry

    schema_context = _build_schema_context()
    repair_system_prompt = (
        "You are a DuckDB SQL repair assistant. Return only corrected SQL, no markdown, no explanation. "
        "The SQL must stay read-only (SELECT/WITH only), preserve intent, and use existing columns/tables only."
    )
    repair_prompt = (
        "Fix this DuckDB SQL query using the execution error and schema context.\n\n"
        f"Error:\n{error_message}\n\n"
        f"Original SQL:\n{original_sql}\n\n"
        f"Schema Context:\n{schema_context}\n\n"
        "Return only corrected SQL."
    )

    try:
        provider = llm_provider_registry.get_provider()
        repaired = await asyncio.wait_for(
            provider.generate(
                prompt=repair_prompt,
                system_prompt=repair_system_prompt,
                config={"temperature": 0.0, "num_predict": 512, "timeout": 8},
            ),
            timeout=8.0,
        )
        if not repaired:
            return None
        cleaned = repaired.strip()
        fence_match = re.search(r"```(?:sql)?\s*\n?([\s\S]*?)```", cleaned)
        if fence_match:
            cleaned = fence_match.group(1).strip()
        return cleaned or None
    except Exception as e:
        logger.warning(f"SQL repair generation failed: {e}")
        return None


async def _execute_with_feedback_loop(sql: str, max_attempts: int = 2):
    current_sql = sql
    last_error: Optional[Exception] = None

    for attempt in range(1, max_attempts + 1):
        try:
            results = _execute_with_qualified_fallback(current_sql)
            return results
        except Exception as e:
            last_error = e
            error_text = str(e)
            if attempt >= max_attempts or not _is_repairable_sql_error(error_text):
                raise

            repaired_sql = await _repair_sql_with_llm(current_sql, error_text)
            if not repaired_sql or repaired_sql.strip() == current_sql.strip():
                raise

            if not connection_service.is_safe_query(repaired_sql):
                logger.warning("Rejected repaired SQL because it was not read-only")
                raise HTTPException(
                    status_code=400,
                    detail={"code": "READ_ONLY_ENFORCED", "message": "Only read-only SELECT queries are allowed."},
                )

            logger.info(f"Retrying SQL execution with LLM-repaired query (attempt {attempt + 1}/{max_attempts})")
            current_sql = repaired_sql

    if last_error:
        raise last_error
    raise RuntimeError("SQL execution failed")


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
        logger.info("Execute requested by user %s", current_user.id)
        if not connection_service.is_safe_query(body.sql):
            raise HTTPException(
                status_code=400,
                detail={"code": "READ_ONLY_ENFORCED", "message": "Only read-only SELECT queries are allowed."},
            )

        # Always execute against DuckDB warehouse — this is where all synced data lives
        results = _execute_with_qualified_fallback(body.sql)
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

            # Stream the AI response with real token-by-token streaming
            from app.services.llm_provider_service import llm_provider_registry

            provider = llm_provider_registry.get_provider()
            full_response = ""

            # Pre-flight: check if local LLM is available before streaming
            if settings.AI_PROVIDER.lower() in ("local", "ollama"):
                from app.services.local_llm_runtime_service import local_llm_runtime_service
                health = await local_llm_runtime_service.health()
                if health.get("status") == "unhealthy" or not health.get("model_present", True):
                    full_response = (
                        "The Kuantra AI model is not available yet. "
                        "Please go to **Settings** and download the AI model first."
                    )
                    yield f"data: {json.dumps({'type': 'chunk', 'content': full_response})}\n\n"
                    yield f"data: {json.dumps({'type': 'model_unavailable'})}\n\n"
                    # Save and finalize below
                    # Skip the streaming block
                    provider = None

            if provider is not None:
                try:
                    async for chunk in provider.stream(
                        prompt=query,
                        system_prompt=system_prompt,
                        history=history if history else None,
                    ):
                        full_response += chunk
                        # Stream each chunk to the frontend immediately
                        yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                except Exception as llm_exc:
                    logger.error(f"LLM provider failed: {llm_exc}")
                    exc_msg = str(llm_exc).lower()
                    if "connection refused" in exc_msg or "connect" in exc_msg:
                        full_response = (
                            "The Kuantra AI model is not reachable. "
                            "Please check that the AI service is running, or go to **Settings** to download the model."
                        )
                        yield f"data: {json.dumps({'type': 'model_unavailable'})}\n\n"
                    elif "timeout" in exc_msg or "timed out" in exc_msg:
                        full_response = (
                            "The AI model took too long to respond. "
                            "Try a shorter question or check resource usage in Settings."
                        )
                    elif "api key" in exc_msg or "api_key" in exc_msg or "unauthorized" in exc_msg:
                        full_response = (
                            "AI API key is invalid or missing. "
                            "Please configure a valid key in Settings."
                        )
                    else:
                        full_response = f"AI encountered an error: {llm_exc}"
                    yield f"data: {json.dumps({'type': 'chunk', 'content': full_response})}\n\n"

            # Now parse the complete response for SQL
            raw = full_response.strip()
            sql_generated = None
            sql_match = re.search(r"```(?:sql)?\s*\n?([\s\S]*?)```", raw)
            if sql_match:
                sql_generated = sql_match.group(1).strip()
                natural_text = re.sub(r"```(?:sql)?\s*\n?[\s\S]*?```", "", raw).strip()
                if not natural_text:
                    natural_text = "Here's a query to answer your question:"
            elif raw.upper().lstrip().startswith(("SELECT ", "WITH ", "INSERT ", "UPDATE ", "DELETE ")):
                sql_generated = raw
                natural_text = "Here's a query to answer your question:"
            else:
                natural_text = raw
                sql_generated = None

            # Send final parsed result (text + sql separated)
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
