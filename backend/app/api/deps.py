from __future__ import annotations

from functools import lru_cache
from typing import Generator, Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import User
from app.db.session import SessionLocal


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    if settings.LOGTO_ISSUER or settings.LOGTO_JWKS_URL:
        if not settings.LOGTO_JWKS_URL:
            raise RuntimeError("LOGTO_JWKS_URL is not configured.")
        return PyJWKClient(settings.LOGTO_JWKS_URL, cache_keys=True)

    if not settings.AUTH_JWKS_URL:
        raise RuntimeError("AUTH_JWKS_URL or LOGTO_JWKS_URL must be configured.")
    return PyJWKClient(settings.AUTH_JWKS_URL, cache_keys=True)


def _extract_bearer_token(request: Request, required: bool = True) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        if required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None
    return auth_header.split(" ", 1)[1]


def _get_or_create_user(db: Session, subject_id: str, payload: dict | None = None) -> User:
    payload = payload or {}
    user = db.query(User).filter(User.subject_id == subject_id).first()
    if user is None:
        user = User(
            subject_id=subject_id,
            email=payload.get("email") or payload.get("email_address") or f"{subject_id}@local",
            username=payload.get("username") or subject_id,
            is_verified=True,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    return user


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    auth_mode = (settings.AUTH_MODE or "dev").lower()

    if auth_mode == "dev":
        return _get_or_create_user(db, "dev-local-user", {"email": "dev@kuantra.local", "username": "dev"})

    if auth_mode == "license":
        token = _extract_bearer_token(request, required=False)
        if not token:
            return _get_or_create_user(db, "license-local-user", {"email": "license@kuantra.local", "username": "license"})
        try:
            payload = jwt.decode(
                token,
                settings.AUTH_SECRET_KEY,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            subject_id = payload.get("sub") or "license-local-user"
            return _get_or_create_user(db, subject_id, payload)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication failed: {exc}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    # jwks mode
    token = _extract_bearer_token(request, required=True)
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        options = {"verify_aud": False}
        issuer = settings.AUTH_ISSUER or None

        if settings.LOGTO_ISSUER:
            issuer = settings.LOGTO_ISSUER
            if settings.LOGTO_AUDIENCE:
                options = {"verify_aud": True, "verify_signature": True}

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES384"],
            options=options,
            issuer=issuer,
            audience=settings.LOGTO_AUDIENCE if settings.LOGTO_AUDIENCE else None,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    subject_id = payload.get("sub")
    if not subject_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _get_or_create_user(db, subject_id, payload)
