"""
Conversation management endpoints for chat history.
"""
import json
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.api.deps import get_current_user
from app.db.models import User, Conversation, ChatMessage
from app.core.logging import logger

router = APIRouter()


# --- Pydantic Schemas ---

class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    sql_query: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetailOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageOut]

    class Config:
        from_attributes = True


class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Conversation"


class UpdateConversationRequest(BaseModel):
    title: str


# --- Endpoints ---

@router.get("/", response_model=List[ConversationOut])
async def list_conversations(current_user: User = Depends(get_current_user)):
    """Get all conversations for the current user, ordered by most recent."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == current_user.id)
            .order_by(desc(Conversation.updated_at))
        )
        conversations = result.scalars().all()
        return conversations


@router.post("/", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: CreateConversationRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new conversation."""
    async with AsyncSessionLocal() as db:
        conversation = Conversation(
            user_id=current_user.id,
            title=request.title or "New Conversation"
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        logger.info(f"Created conversation {conversation.id} for user {current_user.id}")
        return conversation


@router.get("/{conversation_id}", response_model=ConversationDetailOut)
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get a specific conversation with all its messages."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        )
        conversation = result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return conversation


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    conversation_id: UUID,
    request: UpdateConversationRequest,
    current_user: User = Depends(get_current_user)
):
    """Update a conversation's title."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        )
        conversation = result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        conversation.title = request.title
        await db.commit()
        await db.refresh(conversation)
        return conversation


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Delete a conversation and all its messages."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        )
        conversation = result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        await db.delete(conversation)
        await db.commit()
        logger.info(f"Deleted conversation {conversation_id} for user {current_user.id}")
