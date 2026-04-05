from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.db.models import User
from app.services.local_llm_runtime_service import local_llm_runtime_service
from app.core.rate_limit import limiter
from app.core.config import settings

router = APIRouter()


class PullModelRequest(BaseModel):
    model: Optional[str] = None


@router.get("/health")
@limiter.limit(settings.RATE_LIMIT_QUERY_EXECUTE)
async def llm_health(request: Request, current_user: User = Depends(get_current_user)):
    _ = (request, current_user)
    return await local_llm_runtime_service.health()


@router.post("/download")
@limiter.limit(settings.RATE_LIMIT_AUTH_WRITE)
async def download_model(request: Request, payload: PullModelRequest, current_user: User = Depends(get_current_user)):
    _ = (request, current_user)
    try:
        return await local_llm_runtime_service.start_pull(payload.model)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/download/progress")
@limiter.limit(settings.RATE_LIMIT_QUERY_EXECUTE)
async def download_progress(request: Request, current_user: User = Depends(get_current_user)):
    _ = (request, current_user)
    return local_llm_runtime_service.pull_progress()
