from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx
from google import genai
from google.genai import types as genai_types

from app.core.config import settings
from app.core.logging import logger
from app.core.request_context import get_request_llm_api_key


def resolve_google_api_key() -> str:
    request_key = get_request_llm_api_key()
    if request_key:
        return request_key
    if settings.GOOGLE_API_KEY:
        return settings.GOOGLE_API_KEY
    raise RuntimeError(
        "Google API key is not configured. Add it in Settings -> API Keys "
        "or set GOOGLE_API_KEY on the server."
    )


class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, config: Optional[Dict[str, Any]] = None) -> str:
        """Generate a single text response."""

    @abstractmethod
    async def stream(
        self, prompt: str, config: Optional[Dict[str, Any]] = None
    ) -> AsyncIterator[str]:
        """Stream text chunks."""


class GeminiProvider(LLMProvider):
    def __init__(self):
        self._clients: Dict[str, genai.Client] = {}

    def _get_client(self) -> genai.Client:
        api_key = resolve_google_api_key()
        client = self._clients.get(api_key)
        if client is None:
            client = genai.Client(api_key=api_key)
            self._clients[api_key] = client
        return client

    async def generate(self, prompt: str, config: Optional[Dict[str, Any]] = None) -> str:
        def _call() -> str:
            response = self._get_client().models.generate_content(
                model=settings.LLM_MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(**(config or {})),
            )
            return (response.text or "").strip()

        return await asyncio.to_thread(_call)

    async def stream(
        self, prompt: str, config: Optional[Dict[str, Any]] = None
    ) -> AsyncIterator[str]:
        # Fallback stream implementation for current usage.
        text = await self.generate(prompt, config=config)
        if text:
            yield text


class OpenAICompatibleLocalProvider(LLMProvider):
    def __init__(self):
        self.base_url = settings.LOCAL_LLM_BASE_URL.rstrip("/")
        self.model = settings.LOCAL_LLM_MODEL
        self.api_key = settings.LOCAL_LLM_API_KEY

    async def generate(self, prompt: str, config: Optional[Dict[str, Any]] = None) -> str:
        if settings.LOCAL_LLM_AUTO_PULL:
            from app.services.local_llm_runtime_service import local_llm_runtime_service

            await local_llm_runtime_service.ensure_model(self.model)

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": (config or {}).get("temperature", 0.1),
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        timeout = (config or {}).get("timeout", settings.ANALYTICAL_QUERY_TIMEOUT_SECONDS)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
        return (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )

    async def stream(
        self, prompt: str, config: Optional[Dict[str, Any]] = None
    ) -> AsyncIterator[str]:
        text = await self.generate(prompt, config=config)
        if text:
            yield text


class LLMProviderRegistry:
    def __init__(self):
        self._provider: Optional[LLMProvider] = None

    def get_provider(self) -> LLMProvider:
        if self._provider is not None:
            return self._provider

        provider_name = settings.AI_PROVIDER.lower()
        if provider_name == "gemini":
            self._provider = GeminiProvider()
        elif provider_name == "local":
            self._provider = OpenAICompatibleLocalProvider()
        else:
            raise ValueError(f"Unsupported AI provider: {settings.AI_PROVIDER}")

        logger.info(f"Initialized LLM provider: {provider_name}")
        return self._provider


llm_provider_registry = LLMProviderRegistry()
