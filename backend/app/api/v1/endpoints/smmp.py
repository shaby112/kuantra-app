from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.db.models import User
from app.schemas.smmp import (
    NormalizePreviewRequest,
    OAuthAuthorizeResponse,
    OAuthCallbackRequest,
    SocialAccountResponse,
)
from app.services.smmp_normalizers import get_adapter
from app.services.smmp_oauth_service import SMMPConfigError, smmp_oauth_service

router = APIRouter()


@router.get("/oauth/{platform}/authorize", response_model=OAuthAuthorizeResponse)
def get_oauth_authorization_url(
    platform: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    try:
        payload = smmp_oauth_service.build_authorize_url(db, current_user, platform)
        return payload
    except SMMPConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/oauth/{platform}/callback", response_model=SocialAccountResponse)
def complete_oauth_callback(
    platform: str,
    request: OAuthCallbackRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    try:
        account = smmp_oauth_service.consume_callback(
            db=db,
            user=current_user,
            platform=platform.lower(),
            code=request.code,
            state=request.state,
        )
        return SocialAccountResponse(
            id=str(account.id),
            platform=account.platform,
            external_id=account.external_id,
            username=account.username,
            scopes=account.scopes or [],
            token_expires_at=account.token_expires_at,
            status=account.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/accounts", response_model=list[SocialAccountResponse])
def list_smmp_accounts(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    accounts = smmp_oauth_service.list_accounts(db, current_user)
    return [
        SocialAccountResponse(
            id=str(item.id),
            platform=item.platform,
            external_id=item.external_id,
            username=item.username,
            scopes=item.scopes or [],
            token_expires_at=item.token_expires_at,
            status=item.status,
        )
        for item in accounts
    ]


@router.post("/normalize/preview")
def normalize_preview(request: NormalizePreviewRequest):
    try:
        adapter = get_adapter(request.platform)
        normalized = adapter.normalize_post(request.payload)
        return normalized.model_dump()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
