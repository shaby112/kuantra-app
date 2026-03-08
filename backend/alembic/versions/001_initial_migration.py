"""Initial migration baseline (UUID schema)

Revision ID: 001_initial
Revises:
Create Date: 2026-03-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('clerk_id', sa.String(), nullable=False),
        sa.Column('username', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_clerk_id'), 'users', ['clerk_id'], unique=True)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # otps
    op.create_table(
        'otps',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_otps_id'), 'otps', ['id'], unique=False)

    # db_connections
    op.create_table(
        'db_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('host', sa.String(), nullable=True),
        sa.Column('port', sa.Integer(), nullable=True),
        sa.Column('database_name', sa.String(), nullable=True),
        sa.Column('username', sa.String(), nullable=True),
        sa.Column('encrypted_password', sa.String(), nullable=True),
        sa.Column('connection_uri', sa.String(), nullable=True),
        sa.Column('connection_type', sa.String(), nullable=False, server_default=sa.text("'postgres'")),
        sa.Column('file_path', sa.String(), nullable=True),
        sa.Column('use_ssh_tunnel', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('ssh_host', sa.String(), nullable=True),
        sa.Column('ssh_port', sa.Integer(), nullable=True),
        sa.Column('ssh_username', sa.String(), nullable=True),
        sa.Column('ssh_key_path', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_db_connections_id'), 'db_connections', ['id'], unique=False)

    # query_history
    op.create_table(
        'query_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('connection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sql_query', sa.String(), nullable=False),
        sa.Column('row_count', sa.Integer(), nullable=True),
        sa.Column('execution_time_ms', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['connection_id'], ['db_connections.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_query_history_id'), 'query_history', ['id'], unique=False)

    # conversations
    op.create_table(
        'conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(), nullable=False, server_default=sa.text("'New Conversation'")),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_conversations_id'), 'conversations', ['id'], unique=False)

    # chat_messages
    op.create_table(
        'chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('sql_query', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_chat_messages_id'), 'chat_messages', ['id'], unique=False)

    # dashboards
    op.create_table(
        'dashboards',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('config', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_dashboards_id'), 'dashboards', ['id'], unique=False)

    # sync_configs
    op.create_table(
        'sync_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('connection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sync_interval_minutes', sa.Integer(), nullable=True),
        sa.Column('is_auto_sync_enabled', sa.Boolean(), nullable=True),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('last_sync_status', sa.String(), nullable=True),
        sa.Column('last_error', sa.String(), nullable=True),
        sa.Column('rows_cached', sa.Integer(), nullable=True),
        sa.Column('tables_cached', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['connection_id'], ['db_connections.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('connection_id'),
    )
    op.create_index(op.f('ix_sync_configs_id'), 'sync_configs', ['id'], unique=False)

    # sync_history
    op.create_table(
        'sync_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sync_config_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('connection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('rows_synced', sa.Integer(), nullable=True),
        sa.Column('tables_synced', sa.JSON(), nullable=True),
        sa.Column('is_incremental', sa.Boolean(), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['sync_config_id'], ['sync_configs.id']),
        sa.ForeignKeyConstraint(['connection_id'], ['db_connections.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_sync_history_id'), 'sync_history', ['id'], unique=False)

    # mdl_versions
    op.create_table(
        'mdl_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('user_overrides', sa.JSON(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('change_summary', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_mdl_versions_id'), 'mdl_versions', ['id'], unique=False)
    op.create_index(op.f('ix_mdl_versions_version'), 'mdl_versions', ['version'], unique=False)

    # mdl_locks
    op.create_table(
        'mdl_locks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('acquired_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_mdl_locks_id'), 'mdl_locks', ['id'], unique=False)

    # suggested_relationships
    op.create_table(
        'suggested_relationships',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_table', sa.String(), nullable=False),
        sa.Column('from_column', sa.String(), nullable=False),
        sa.Column('to_table', sa.String(), nullable=False),
        sa.Column('to_column', sa.String(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('confirmed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['confirmed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_suggested_relationships_id'), 'suggested_relationships', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_suggested_relationships_id'), table_name='suggested_relationships')
    op.drop_table('suggested_relationships')

    op.drop_index(op.f('ix_mdl_locks_id'), table_name='mdl_locks')
    op.drop_table('mdl_locks')

    op.drop_index(op.f('ix_mdl_versions_version'), table_name='mdl_versions')
    op.drop_index(op.f('ix_mdl_versions_id'), table_name='mdl_versions')
    op.drop_table('mdl_versions')

    op.drop_index(op.f('ix_sync_history_id'), table_name='sync_history')
    op.drop_table('sync_history')

    op.drop_index(op.f('ix_sync_configs_id'), table_name='sync_configs')
    op.drop_table('sync_configs')

    op.drop_index(op.f('ix_dashboards_id'), table_name='dashboards')
    op.drop_table('dashboards')

    op.drop_index(op.f('ix_chat_messages_id'), table_name='chat_messages')
    op.drop_table('chat_messages')

    op.drop_index(op.f('ix_conversations_id'), table_name='conversations')
    op.drop_table('conversations')

    op.drop_index(op.f('ix_query_history_id'), table_name='query_history')
    op.drop_table('query_history')

    op.drop_index(op.f('ix_db_connections_id'), table_name='db_connections')
    op.drop_table('db_connections')

    op.drop_index(op.f('ix_otps_id'), table_name='otps')
    op.drop_table('otps')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_clerk_id'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
