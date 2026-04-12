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
    async def generate(
        self,
        prompt: str,
        config: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """Generate a single text response."""

    @abstractmethod
    async def stream(
        self,
        prompt: str,
        config: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
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

    async def generate(
        self,
        prompt: str,
        config: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        def _call() -> str:
            cfg = dict(config or {})
            if system_prompt:
                cfg["system_instruction"] = system_prompt
            response = self._get_client().models.generate_content(
                model=settings.LLM_MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(**cfg),
            )
            return (response.text or "").strip()

        return await asyncio.to_thread(_call)

    async def stream(
        self,
        prompt: str,
        config: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncIterator[str]:
        # Fallback stream implementation for current usage.
        text = await self.generate(prompt, config=config, system_prompt=system_prompt, history=history)
        if text:
            yield text


class OpenAICompatibleLocalProvider(LLMProvider):
    def __init__(self):
        self.base_url = settings.LOCAL_LLM_BASE_URL.rstrip("/")
        self.model = settings.LOCAL_LLM_MODEL
        self.api_key = settings.LOCAL_LLM_API_KEY
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self, timeout: float = 300.0) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(timeout, connect=30.0)
            )
        return self._client

    def _build_messages(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> List[Dict[str, str]]:
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})
        return messages

    def _build_payload(
        self,
        messages: List[Dict[str, str]],
        config: Optional[Dict[str, Any]] = None,
        stream: bool = False,
    ) -> Dict[str, Any]:
        return {
            "model": self.model,
            "messages": messages,
            "temperature": (config or {}).get("temperature", 0.1),
            "max_tokens": (config or {}).get("num_predict", 1024),
            "stream": stream,
        }

    def _build_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def _ensure_model(self):
        if settings.LOCAL_LLM_AUTO_PULL:
            from app.services.local_llm_runtime_service import local_llm_runtime_service
            await local_llm_runtime_service.ensure_model(self.model)

    async def generate(
        self,
        prompt: str,
        config: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        await self._ensure_model()

        messages = self._build_messages(prompt, system_prompt, history)
        payload = self._build_payload(messages, config, stream=False)
        headers = self._build_headers()
        timeout = (config or {}).get("timeout", max(settings.ANALYTICAL_QUERY_TIMEOUT_SECONDS, 300))

        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=30.0)) as client:
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
        self,
        prompt: str,
        config: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncIterator[str]:
        """Real streaming via Ollama OpenAI-compatible SSE endpoint."""
        await self._ensure_model()

        messages = self._build_messages(prompt, system_prompt, history)
        payload = self._build_payload(messages, config, stream=True)
        headers = self._build_headers()
        timeout = (config or {}).get("timeout", max(settings.ANALYTICAL_QUERY_TIMEOUT_SECONDS, 300))

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=30.0)) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/v1/chat/completions",
                    json=payload,
                    headers=headers,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            import json as _json
                            chunk = _json.loads(data_str)
                            delta = (
                                chunk.get("choices", [{}])[0]
                                .get("delta", {})
                                .get("content", "")
                            )
                            if delta:
                                yield delta
                        except Exception:
                            continue
        except Exception as e:
            logger.error(f"Streaming failed, falling back to generate: {e}")
            text = await self.generate(prompt, config=config, system_prompt=system_prompt, history=history)
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
        elif provider_name in ("local", "ollama"):
            self._provider = OpenAICompatibleLocalProvider()
        else:
            raise ValueError(f"Unsupported AI provider: {settings.AI_PROVIDER}")

        logger.info(f"Initialized LLM provider: {provider_name}")
        return self._provider


llm_provider_registry = LLMProviderRegistry()
