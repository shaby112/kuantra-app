"""
Chat endpoints with conversation history support.
"""
import asyncio
import json
from uuid import UUID
from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Any
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
    http_request: Request,
    request: ExecuteRequest,
    current_user: User = Depends(get_current_user)
):
    """Execute a SQL query."""
    _ = http_request
    try:
        if not connection_service.is_safe_query(request.sql):
            raise HTTPException(
                status_code=400,
                detail={"code": "READ_ONLY_ENFORCED", "message": "Only read-only SELECT queries are allowed."},
            )

        if request.connection_id:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(DbConnection).where(
                        DbConnection.id == request.connection_id,
                        DbConnection.user_id == current_user.id
                    )
                )
                conn_model = result.scalar_one_or_none()
                if not conn_model:
                    raise HTTPException(status_code=404, detail="Data source not found")
                
                query_result = await connection_service.execute_external_query(conn_model, request.sql)
                return {"results": query_result["results"]}
        
        # Fallback to internal/system DB in read-only mode.
        async with AsyncSessionLocal() as db:
            safe_sql = connection_service.optimize_query(request.sql)
            result = await asyncio.wait_for(
                db.execute(text(safe_sql)),
                timeout=settings.EXTERNAL_QUERY_TIMEOUT_SECONDS,
            )
            columns = result.keys()
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
            return {"results": rows}
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

            # Stream the AI response
            full_response = ""
            sql_generated = None

            # Orchestrate response using ADK Agents when available; fallback to configured LLM provider.
            try:
                from app.agents.orchestrator import process_user_message
                full_response = await process_user_message(query)
            except Exception as agent_exc:
                logger.warning(f"ADK orchestrator unavailable, using provider fallback: {agent_exc}")
                from app.services.llm_provider_service import llm_provider_registry

                provider = llm_provider_registry.get_provider()
                try:
                    full_response = await provider.generate(query)
                except Exception as llm_exc:
                    logger.error(f"LLM provider failed: {llm_exc}")
                    full_response = (
                        "AI is temporarily unavailable. Please configure a valid AI key in Settings "
                        "or switch to Local AI and download the model."
                    )
            
            # Simulate streaming or just yield result
            # For production grade, we'd enable native streaming in ADK, but for now we yield the result.
            yield f"data: {json.dumps({'type': 'text', 'content': full_response})}\n\n"
            yield f"data: {json.dumps({'type': 'status', 'sql': 'Generated via Wren Semantic Layer'})}\n\n"

            # Save assistant response
            if full_response:
                async with AsyncSessionLocal() as db:
                    assistant_msg = ChatMessage(
                        conversation_id=conv.id,
                        role="assistant",
                        content=full_response,
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
