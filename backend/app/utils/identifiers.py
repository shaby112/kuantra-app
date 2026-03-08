from __future__ import annotations

from typing import Union
from uuid import UUID


UUIDLike = Union[str, UUID]


def to_uuid(value: UUIDLike) -> UUID:
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def connection_schema_name(connection_id: UUIDLike) -> str:
    """
    Build a DuckDB-safe schema name from a UUID.
    Uses UUID hex to avoid dashes and punctuation.
    """
    return f"conn_{to_uuid(connection_id).hex}"
