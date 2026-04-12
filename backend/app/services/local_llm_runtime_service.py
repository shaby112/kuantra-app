from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings
from app.core.logging import logger


def _normalize_ollama_base_url(base_url: str) -> str:
    base = (base_url or "").strip().rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3]
    return base


@dataclass
class PullState:
    running: bool = False
    model: str = ""
    status: str = "idle"
    digest: Optional[str] = None
    completed: int = 0
    total: int = 0
    error: Optional[str] = None


class LocalLLMRuntimeService:
    def __init__(self) -> None:
        self._state = PullState()
        self._lock = asyncio.Lock()

    def _base(self) -> str:
        base = _normalize_ollama_base_url(settings.LOCAL_LLM_BASE_URL)
        if not base:
            raise RuntimeError("LOCAL_LLM_BASE_URL is not configured")
        return base

    async def health(self) -> Dict[str, Any]:
        if settings.AI_PROVIDER.lower() not in ("local", "ollama"):
            return {"status": "disabled", "provider": settings.AI_PROVIDER}

        base = self._base()

        try:
            async with httpx.AsyncClient(timeout=settings.LOCAL_LLM_HEALTH_TIMEOUT_SECONDS) as client:
                # Try llama-server /health first, then Ollama /api/tags
                try:
                    health_resp = await client.get(f"{base}/health")
                    health_resp.raise_for_status()
                    data = health_resp.json()
                    if data.get("status") == "ok":
                        return {
                            "status": "healthy",
                            "provider": "local",
                            "base_url": base,
                            "model": settings.LOCAL_LLM_MODEL,
                            "model_present": True,
                        }
                except httpx.HTTPStatusError:
                    pass

                # Fallback: Ollama /api/tags
                tags_resp = await client.get(f"{base}/api/tags")
                tags_resp.raise_for_status()
                tags = tags_resp.json().get("models", [])
                model_names = [m.get("name", "") for m in tags]
                target = settings.LOCAL_LLM_MODEL
                model_present = any(
                    n == target or n == f"{target}:latest" or n.split(":")[0] == target
                    for n in model_names
                )
                return {
                    "status": "healthy",
                    "provider": "local",
                    "base_url": base,
                    "model": settings.LOCAL_LLM_MODEL,
                    "model_present": model_present,
                    "models_count": len(tags),
                }
        except Exception as exc:
            return {
                "status": "unhealthy",
                "provider": "local",
                "base_url": settings.LOCAL_LLM_BASE_URL,
                "model": settings.LOCAL_LLM_MODEL,
                "error": str(exc),
            }

    async def ensure_model(self, model: Optional[str] = None) -> Dict[str, Any]:
        target_model = model or settings.LOCAL_LLM_MODEL
        health = await self.health()
        if health.get("status") == "healthy" and health.get("model_present"):
            return {"ok": True, "already_present": True, "model": target_model}

        await self.start_pull(target_model)
        return {"ok": True, "already_present": False, "model": target_model}

    async def start_pull(self, model: Optional[str] = None) -> Dict[str, Any]:
        target_model = model or settings.LOCAL_LLM_MODEL
        async with self._lock:
            if self._state.running:
                return {"started": False, "reason": "pull_already_running", "state": asdict(self._state)}

            self._state = PullState(running=True, model=target_model, status="starting")
            asyncio.create_task(self._pull_task(target_model))
            return {"started": True, "model": target_model}

    async def _pull_task(self, model: str) -> None:
        try:
            payload = {"name": model, "stream": True}
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", f"{self._base()}/api/pull", json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            item = json.loads(line)
                        except Exception:
                            continue
                        self._state.status = item.get("status", self._state.status)
                        self._state.digest = item.get("digest", self._state.digest)
                        self._state.completed = int(item.get("completed") or self._state.completed or 0)
                        self._state.total = int(item.get("total") or self._state.total or 0)

            self._state.running = False
            if self._state.status in {"success", "pulled", "done"}:
                self._state.status = "completed"
            elif self._state.status == "starting":
                self._state.status = "completed"
        except Exception as exc:
            logger.error(f"Local model pull failed: {exc}")
            self._state.running = False
            self._state.error = str(exc)
            self._state.status = "failed"

    def pull_progress(self) -> Dict[str, Any]:
        state = asdict(self._state)
        total = state.get("total") or 0
        completed = state.get("completed") or 0
        pct = round((completed / total) * 100, 2) if total > 0 else 0.0
        state["progress_percent"] = pct
        return state


local_llm_runtime_service = LocalLLMRuntimeService()
