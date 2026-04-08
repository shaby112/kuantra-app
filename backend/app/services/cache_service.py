import json
import threading
import time
import hashlib
from collections import OrderedDict
from typing import Any, Optional, Dict, Tuple

from app.core.config import settings
from app.core.logging import logger

try:
    import redis
except Exception:  # pragma: no cover
    redis = None


class CacheService:
    """Best-effort cache service with Redis-first and in-memory fallback."""

    def __init__(self) -> None:
        self._memory: "OrderedDict[str, Tuple[float, str]]" = OrderedDict()
        self._max_memory_entries = int(getattr(settings, "CACHE_MAX_MEMORY_ENTRIES", 10000))
        self._lock = threading.Lock()
        self._redis = None

        if redis is not None:
            try:
                client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
                client.ping()
                self._redis = client
                logger.info("CacheService initialized with Redis backend")
            except Exception as exc:
                logger.warning(f"Redis unavailable. Falling back to in-memory cache: {exc}")

    @staticmethod
    def make_key(namespace: str, payload: Dict[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, default=str)
        digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
        return f"{namespace}:{digest}"

    def get(self, key: str) -> Optional[Any]:
        if self._redis is not None:
            try:
                raw = self._redis.get(key)
                return json.loads(raw) if raw else None
            except Exception as exc:
                logger.warning(f"Redis get failed for key={key}: {exc}")

        with self._lock:
            item = self._memory.get(key)
            if not item:
                return None
            expires_at, raw = item
            if expires_at < time.time():
                self._memory.pop(key, None)
                return None
            # LRU touch
            self._memory.move_to_end(key)
            return json.loads(raw)

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        raw = json.dumps(value, default=str)
        if self._redis is not None:
            try:
                self._redis.setex(key, ttl_seconds, raw)
                return
            except Exception as exc:
                logger.warning(f"Redis set failed for key={key}: {exc}")

        with self._lock:
            self._memory[key] = (time.time() + ttl_seconds, raw)
            self._memory.move_to_end(key)
            while len(self._memory) > self._max_memory_entries:
                self._memory.popitem(last=False)

    def invalidate(self, key: str) -> None:
        if self._redis is not None:
            try:
                self._redis.delete(key)
            except Exception as exc:
                logger.warning(f"Redis delete failed for key={key}: {exc}")

        with self._lock:
            self._memory.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> int:
        """Safe invalidation hook for namespace/key-prefix based invalidation."""
        deleted = 0

        if self._redis is not None:
            try:
                pattern = f"{prefix}*"
                cursor = 0
                while True:
                    cursor, keys = self._redis.scan(cursor=cursor, match=pattern, count=200)
                    if keys:
                        deleted += int(self._redis.delete(*keys))
                    if cursor == 0:
                        break
            except Exception as exc:
                logger.warning(f"Redis prefix invalidation failed for prefix={prefix}: {exc}")

        with self._lock:
            keys = [k for k in self._memory.keys() if k.startswith(prefix)]
            for k in keys:
                self._memory.pop(k, None)
                deleted += 1

        return deleted


cache_service = CacheService()
