from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple
from urllib.parse import urlencode

import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import SocialAccount, SocialOAuthState, User
from app.utils.crypto import crypto_service


class SMMPConfigError(Exception):
    pass


class SMMPOAuthService:
    PLATFORM_CONFIG = {
        "linkedin": {
            "scopes": ["w_member_social", "r_liteprofile", "r_ads_reporting"],
            "auth_url": "https://www.linkedin.com/oauth/v2/authorization",
            "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
            "profile_url": "https://api.linkedin.com/v2/userinfo",
        },
        "reddit": {
            "scopes": ["submit", "read", "identity", "history"],
            "auth_url": "https://www.reddit.com/api/v1/authorize",
            "token_url": "https://www.reddit.com/api/v1/access_token",
            "profile_url": "https://oauth.reddit.com/api/v1/me",
        },
        "x": {
            "scopes": ["tweet.read", "tweet.write", "users.read", "offline.access"],
            "auth_url": "https://twitter.com/i/oauth2/authorize",
            "token_url": "https://api.twitter.com/2/oauth2/token",
            "profile_url": "https://api.twitter.com/2/users/me",
        },
    }

    def _client_config(self, platform: str) -> Tuple[str, str, str]:
        key = platform.upper().replace("-", "_")
        client_id = getattr(settings, f"SMMP_{key}_CLIENT_ID", "")
        client_secret = getattr(settings, f"SMMP_{key}_CLIENT_SECRET", "")
        redirect_uri = getattr(settings, f"SMMP_{key}_REDIRECT_URI", "")
        if not client_id or not redirect_uri:
            raise SMMPConfigError(f"Missing OAuth config for {platform}")
        return client_id, client_secret, redirect_uri

    @staticmethod
    def _pkce_pair() -> Tuple[str, str]:
        code_verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest()).decode().rstrip("=")
        return code_verifier, challenge

    def build_authorize_url(self, db: Session, user: User, platform: str) -> Dict[str, Any]:
        platform = platform.lower()
        if platform not in self.PLATFORM_CONFIG:
            raise ValueError("Unsupported platform")

        client_id, _, redirect_uri = self._client_config(platform)
        provider = self.PLATFORM_CONFIG[platform]

        state = secrets.token_urlsafe(32)
        code_verifier, code_challenge = self._pkce_pair()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        state_row = SocialOAuthState(
            user_id=user.id,
            platform=platform,
            state=state,
            code_verifier=code_verifier,
            expires_at=expires_at,
        )
        db.add(state_row)
        db.commit()

        params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": " ".join(provider["scopes"]),
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        if platform == "reddit":
            params["duration"] = "permanent"

        return {
            "authorization_url": f"{provider['auth_url']}?{urlencode(params)}",
            "state": state,
            "expires_at": expires_at,
        }

    def _exchange_code(self, platform: str, code: str, code_verifier: str) -> Dict[str, Any]:
        provider = self.PLATFORM_CONFIG[platform]
        client_id, client_secret, redirect_uri = self._client_config(platform)

        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "code_verifier": code_verifier,
        }

        auth = None
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        if platform == "reddit":
            auth = (client_id, client_secret)
            headers["User-Agent"] = "KuantraSMMP/1.0"

        response = requests.post(provider["token_url"], data=payload, headers=headers, auth=auth, timeout=20)
        response.raise_for_status()
        return response.json()

    def _fetch_profile(self, platform: str, access_token: str) -> Dict[str, Any]:
        provider = self.PLATFORM_CONFIG[platform]
        headers = {"Authorization": f"Bearer {access_token}"}
        if platform == "reddit":
            headers["User-Agent"] = "KuantraSMMP/1.0"
        response = requests.get(provider["profile_url"], headers=headers, timeout=20)
        response.raise_for_status()
        return response.json()

    def consume_callback(self, db: Session, user: User, platform: str, code: str, state: str) -> SocialAccount:
        now = datetime.now(timezone.utc)
        state_row = (
            db.query(SocialOAuthState)
            .filter(
                SocialOAuthState.user_id == user.id,
                SocialOAuthState.platform == platform,
                SocialOAuthState.state == state,
            )
            .first()
        )
        if not state_row or state_row.expires_at < now:
            raise ValueError("Invalid or expired OAuth state")

        token_payload = self._exchange_code(platform, code, state_row.code_verifier)
        access_token = token_payload.get("access_token")
        refresh_token = token_payload.get("refresh_token")
        expires_in = int(token_payload.get("expires_in", 3600) or 3600)

        if not access_token:
            raise ValueError("Token exchange failed: missing access token")

        profile = self._fetch_profile(platform, access_token)

        external_id = (
            str(profile.get("sub") or profile.get("id") or profile.get("name") or "")
        )
        username = profile.get("preferred_username") or profile.get("name") or profile.get("username")

        account = (
            db.query(SocialAccount)
            .filter(SocialAccount.user_id == user.id, SocialAccount.platform == platform, SocialAccount.external_id == external_id)
            .first()
        )

        if not account:
            account = SocialAccount(
                user_id=user.id,
                platform=platform,
                external_id=external_id,
                username=username,
                encrypted_access_token=crypto_service.encrypt(access_token),
                encrypted_refresh_token=crypto_service.encrypt(refresh_token) if refresh_token else None,
                token_expires_at=now + timedelta(seconds=expires_in),
                scopes=self.PLATFORM_CONFIG[platform]["scopes"],
                status="active",
            )
            db.add(account)
        else:
            account.username = username
            account.encrypted_access_token = crypto_service.encrypt(access_token)
            account.encrypted_refresh_token = crypto_service.encrypt(refresh_token) if refresh_token else account.encrypted_refresh_token
            account.token_expires_at = now + timedelta(seconds=expires_in)
            account.scopes = self.PLATFORM_CONFIG[platform]["scopes"]
            account.status = "active"

        db.delete(state_row)
        db.commit()
        db.refresh(account)
        return account

    def list_accounts(self, db: Session, user: User) -> List[SocialAccount]:
        return db.query(SocialAccount).filter(SocialAccount.user_id == user.id).all()


smmp_oauth_service = SMMPOAuthService()
