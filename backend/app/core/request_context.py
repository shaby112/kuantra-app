from contextvars import ContextVar, Token
from typing import Optional

_request_llm_api_key: ContextVar[Optional[str]] = ContextVar(
    "request_llm_api_key",
    default=None,
)


def set_request_llm_api_key(value: Optional[str]) -> Token:
    if value is not None:
        value = value.strip()
    return _request_llm_api_key.set(value or None)


def reset_request_llm_api_key(token: Token) -> None:
    _request_llm_api_key.reset(token)


def get_request_llm_api_key() -> Optional[str]:
    return _request_llm_api_key.get()

