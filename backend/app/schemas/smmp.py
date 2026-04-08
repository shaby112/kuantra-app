from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class OAuthAuthorizeResponse(BaseModel):
    authorization_url: str
    state: str
    expires_at: datetime


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


class SocialAccountResponse(BaseModel):
    id: str
    platform: str
    external_id: str
    username: Optional[str]
    scopes: List[str] = Field(default_factory=list)
    token_expires_at: Optional[datetime]
    status: str


class NormalizedMetric(BaseModel):
    likes: int = 0
    shares: int = 0
    comments: int = 0
    impressions: int = 0


class NormalizedPost(BaseModel):
    platform: str
    platform_id: Optional[str] = None
    external_id: str
    content: str
    media_urls: List[str] = Field(default_factory=list)
    metrics: NormalizedMetric = Field(default_factory=NormalizedMetric)
    published_at: Optional[datetime] = None
    raw: Dict[str, Any] = Field(default_factory=dict)


class NormalizePreviewRequest(BaseModel):
    platform: str
    payload: Dict[str, Any]
