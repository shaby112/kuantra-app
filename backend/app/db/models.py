import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


def _uuid_pk():
    return Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)


class User(Base):
    __tablename__ = "users"

    id = _uuid_pk()
    clerk_id = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    is_verified = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    otps = relationship("OTP", back_populates="user", cascade="all, delete-orphan")
    connections = relationship("DbConnection", back_populates="user", cascade="all, delete-orphan")
    dashboards = relationship("Dashboard", back_populates="user", cascade="all, delete-orphan")


class OTP(Base):
    __tablename__ = "otps"

    id = _uuid_pk()
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    code = Column(String, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="otps")


class DbConnection(Base):
    __tablename__ = "db_connections"

    id = _uuid_pk()
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    host = Column(String, nullable=True)
    port = Column(Integer, default=5432, nullable=True)
    database_name = Column(String, nullable=True)
    username = Column(String, nullable=True)
    encrypted_password = Column(String, nullable=True)
    connection_uri = Column(String, nullable=True)
    connection_type = Column(String, default="postgres", nullable=False)
    file_path = Column(String, nullable=True)
    use_ssh_tunnel = Column(Boolean, default=False, nullable=False)
    ssh_host = Column(String, nullable=True)
    ssh_port = Column(Integer, default=22, nullable=True)
    ssh_username = Column(String, nullable=True)
    ssh_key_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="connections")
    queries = relationship("QueryHistory", back_populates="connection", cascade="all, delete-orphan")
    sync_config = relationship("SyncConfig", back_populates="connection", uselist=False, cascade="all, delete-orphan")


class QueryHistory(Base):
    __tablename__ = "query_history"

    id = _uuid_pk()
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    connection_id = Column(PG_UUID(as_uuid=True), ForeignKey("db_connections.id"), nullable=False)
    sql_query = Column(String, nullable=False)
    row_count = Column(Integer, default=0)
    execution_time_ms = Column(Integer, nullable=True)
    status = Column(String, default="success")
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User")
    connection = relationship("DbConnection", back_populates="queries")


class Conversation(Base):
    __tablename__ = "conversations"

    id = _uuid_pk()
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String, default="New Conversation", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User")
    messages = relationship(
        "ChatMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = _uuid_pk()
    conversation_id = Column(PG_UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(String, nullable=False)
    sql_query = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    conversation = relationship("Conversation", back_populates="messages")


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = _uuid_pk()
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    config = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="dashboards")


class SyncConfig(Base):
    __tablename__ = "sync_configs"

    id = _uuid_pk()
    connection_id = Column(PG_UUID(as_uuid=True), ForeignKey("db_connections.id"), unique=True, nullable=False)
    sync_interval_minutes = Column(Integer, default=60)
    is_auto_sync_enabled = Column(Boolean, default=False)
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(String, default="never")
    last_error = Column(String, nullable=True)
    rows_cached = Column(Integer, default=0)
    tables_cached = Column(JSON, default=list)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    connection = relationship("DbConnection", back_populates="sync_config")
    sync_history = relationship("SyncHistory", back_populates="sync_config", cascade="all, delete-orphan")


class SyncHistory(Base):
    __tablename__ = "sync_history"

    id = _uuid_pk()
    sync_config_id = Column(PG_UUID(as_uuid=True), ForeignKey("sync_configs.id"), nullable=False)
    connection_id = Column(PG_UUID(as_uuid=True), ForeignKey("db_connections.id"), nullable=False)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default="running")
    rows_synced = Column(Integer, default=0)
    tables_synced = Column(JSON, default=list)
    is_incremental = Column(Boolean, default=False)
    error_message = Column(String, nullable=True)
    duration_seconds = Column(Float, nullable=True)

    sync_config = relationship("SyncConfig", back_populates="sync_history")


class MDLVersion(Base):
    __tablename__ = "mdl_versions"

    id = _uuid_pk()
    version = Column(Integer, nullable=False, index=True)
    content = Column(JSON, nullable=False)
    user_overrides = Column(JSON, default=dict)
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    change_summary = Column(String, nullable=True)

    user = relationship("User")


class MDLLock(Base):
    __tablename__ = "mdl_locks"

    id = _uuid_pk()
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    acquired_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User")


class SuggestedRelationship(Base):
    __tablename__ = "suggested_relationships"

    id = _uuid_pk()
    from_table = Column(String, nullable=False)
    from_column = Column(String, nullable=False)
    to_table = Column(String, nullable=False)
    to_column = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    status = Column(String, default="pending")
    confirmed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User")
