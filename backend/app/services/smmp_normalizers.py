from typing import Any, Dict

from app.schemas.smmp import NormalizedMetric, NormalizedPost


class BaseSMMPAdapter:
    platform: str

    def normalize_post(self, payload: Dict[str, Any]) -> NormalizedPost:
        raise NotImplementedError


class LinkedInAdapter(BaseSMMPAdapter):
    platform = "linkedin"

    def normalize_post(self, payload: Dict[str, Any]) -> NormalizedPost:
        urn = payload.get("id") or payload.get("urn", "")
        media = payload.get("media") or []
        media_urls = [m.get("url") for m in media if isinstance(m, dict) and m.get("url")]
        metrics = payload.get("metrics") or {}

        return NormalizedPost(
            platform=self.platform,
            external_id=str(urn),
            content=payload.get("text") or payload.get("commentary") or "",
            media_urls=media_urls,
            metrics=NormalizedMetric(
                likes=int(metrics.get("likes", 0) or 0),
                shares=int(metrics.get("shares", 0) or 0),
                comments=int(metrics.get("comments", 0) or 0),
                impressions=int(metrics.get("impressions", 0) or 0),
            ),
            raw=payload,
        )


class RedditAdapter(BaseSMMPAdapter):
    platform = "reddit"

    def normalize_post(self, payload: Dict[str, Any]) -> NormalizedPost:
        data = payload.get("data", payload)
        media_urls = []
        if data.get("url"):
            media_urls.append(data["url"])

        return NormalizedPost(
            platform=self.platform,
            external_id=str(data.get("id", "")),
            content=data.get("selftext") or data.get("title") or "",
            media_urls=media_urls,
            metrics=NormalizedMetric(
                likes=int(data.get("ups", 0) or 0),
                shares=int(data.get("num_crossposts", 0) or 0),
                comments=int(data.get("num_comments", 0) or 0),
                impressions=int(data.get("view_count", 0) or 0),
            ),
            raw=payload,
        )


class XAdapter(BaseSMMPAdapter):
    platform = "x"

    def normalize_post(self, payload: Dict[str, Any]) -> NormalizedPost:
        data = payload.get("data", payload)
        metrics = data.get("public_metrics") or payload.get("metrics") or {}

        return NormalizedPost(
            platform=self.platform,
            external_id=str(data.get("id", "")),
            content=data.get("text") or "",
            media_urls=[],
            metrics=NormalizedMetric(
                likes=int(metrics.get("like_count", metrics.get("likes", 0)) or 0),
                shares=int(metrics.get("retweet_count", metrics.get("shares", 0)) or 0),
                comments=int(metrics.get("reply_count", metrics.get("comments", 0)) or 0),
                impressions=int(metrics.get("impression_count", metrics.get("impressions", 0)) or 0),
            ),
            raw=payload,
        )


ADAPTERS = {
    "linkedin": LinkedInAdapter(),
    "reddit": RedditAdapter(),
    "x": XAdapter(),
}


def get_adapter(platform: str) -> BaseSMMPAdapter:
    key = (platform or "").lower()
    if key not in ADAPTERS:
        raise ValueError(f"Unsupported platform: {platform}")
    return ADAPTERS[key]
