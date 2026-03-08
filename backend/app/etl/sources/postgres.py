"""
PostgreSQL Source Connector.

Features:
- Async connection using asyncpg
- Schema discovery
- Incremental extraction using updated_at column
- Primary key detection
"""

import asyncio
import uuid
from typing import Dict, Any, List, Optional, Tuple, AsyncGenerator
from datetime import datetime
from contextlib import asynccontextmanager

from app.db.models import DbConnection
from app.utils.crypto import crypto_service
from app.core.logging import logger


class PostgresSource:
    """PostgreSQL data source connector."""
    
    def __init__(self, connection: DbConnection):
        self.connection = connection
        self._pool = None
        from app.utils.ssh_tunnel import SSHTunnelManager
        self._tunnel_mgr = SSHTunnelManager(connection)
        self._tunnel = None
        self._pool_lock = asyncio.Lock()
    
    async def _get_pool(self):
        """Get or create asyncpg connection pool."""
        import asyncpg
        
        async with self._pool_lock:
            if self._pool:
                return self._pool
            
            # Determine host/port (with tunnel if enabled)
            host = self.connection.host
            port = self.connection.port or 5432
            
            if self.connection.use_ssh_tunnel:
                self._tunnel, host, port = self._tunnel_mgr.start()

            dsn = None
            password = None
            if self.connection.encrypted_password:
                password = crypto_service.decrypt(self.connection.encrypted_password)

            if self.connection.connection_uri:
                uri = self.connection.connection_uri
                if self.connection.use_ssh_tunnel:
                     # Rewrite URI to use tunnel
                     from sqlalchemy.engine.url import make_url
                     url = make_url(uri)
                     uri = f"postgresql://{url.username}:{url.password}@{host}:{port}/{url.database}"

                if "postgresql+asyncpg://" in uri:
                    uri = uri.replace("postgresql+asyncpg://", "postgresql://")
                dsn = uri
            
            # Create pool with enterprise-ready settings
            self._pool = await asyncpg.create_pool(
                dsn=dsn,
                user=self.connection.username if not dsn else None,
                password=password,
                database=self.connection.database_name if not dsn else None,
                host=host if not dsn else None,
                port=port if not dsn else None,
                min_size=1,
                max_size=20, # Allow up to 20 concurrent extractions
                max_queries=50000,
                statement_cache_size=0,
                ssl='require' if ('supabase' in (dsn or "") or 'supabase' in (self.connection.host or "")) and not self.connection.use_ssh_tunnel else None
            )
            
            return self._pool
    
    @asynccontextmanager
    async def _get_connection(self):
        """Get a connection from the pool."""
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            yield conn
    
    async def get_tables(self) -> List[str]:
        """Get list of tables from all non-system schemas."""
        query = """
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            AND table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY table_schema, table_name
        """
        
        async with self._get_connection() as conn:
            rows = await conn.fetch(query)
            tables = []
            for row in rows:
                if row["table_schema"] == 'public':
                    tables.append(row["table_name"])
                else:
                    tables.append(f"{row['table_schema']}.{row['table_name']}")
            return tables
    
    async def get_primary_key(self, table_name: str) -> Optional[str]:
        """Get primary key column for a table (handles schema.table)."""
        schema = 'public'
        name = table_name
        if '.' in table_name:
            schema, name = table_name.split('.', 1)
        
        query = """
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            JOIN pg_class c ON c.oid = i.indrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE i.indisprimary
            AND n.nspname = $1
            AND c.relname = $2
            LIMIT 1
        """
        
        async with self._get_connection() as conn:
            row = await conn.fetchrow(query, schema, name)
            return row["attname"] if row else None
    
    async def has_column(self, table_name: str, column_name: str) -> bool:
        """Check if a table has a specific column (handles schema.table)."""
        schema = 'public'
        name = table_name
        if '.' in table_name:
            schema, name = table_name.split('.', 1)
        
        query = """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = $1
                AND table_name = $2 
                AND column_name = $3
            )
        """
        
        async with self._get_connection() as conn:
            result = await conn.fetchval(query, schema, name, column_name)
            return result
    
    async def get_max_cursor_value(self, table_name: str, cursor_column: str) -> Optional[str]:
        """Get the maximum value of a cursor column."""
        query = f"SELECT MAX({cursor_column}) FROM {table_name}"
        async with self._get_connection() as conn:
            result = await conn.fetchval(query)
            
            if result and isinstance(result, datetime):
                return result.isoformat()
            return str(result) if result else None
    
    async def get_row_count(self, table_name: str) -> int:
        """Get approximate row count for a table (for adaptive fetch sizing)."""
        if "." in table_name:
            s, t = table_name.split(".", 1)
            quoted_table = f'"{s}"."{t}"'
        else:
            quoted_table = f'"{table_name}"'
        
        query = f"SELECT COUNT(*) FROM {quoted_table}"
        async with self._get_connection() as conn:
            try:
                result = await conn.fetchval(query)
                return result or 0
            except Exception as e:
                logger.warning(f"Could not get row count for {table_name}: {e}")
                return 0  # Default: treat as small table
    
    def _get_adaptive_fetch_size(self, row_count: int) -> int:
        """Determine optimal fetch size based on table row count."""
        from app.core.config import settings
        
        if row_count > getattr(settings, 'ETL_LARGE_TABLE_THRESHOLD', 100000):
            return getattr(settings, 'ETL_FETCH_SIZE_LARGE', 200)
        elif row_count > 10000:
            return getattr(settings, 'ETL_FETCH_SIZE_MEDIUM', 500)
        else:
            return getattr(settings, 'ETL_FETCH_SIZE_SMALL', 1000)
    
    async def stream_table(
        self,
        table_name: str,
        incremental: bool = False,
        last_cursor: Optional[str] = None,
        cursor_column: Optional[str] = None,
        row_count: Optional[int] = None  # Pre-computed row count for batch optimization
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream data from a table using an async generator.
        
        Handles tables of any size (including 1M+ rows) with:
        - Adaptive fetch sizes based on table row count
        - Timeout handling to detect stuck queries
        - Memory-safe streaming (yields immediately, no accumulation)
        """
        from app.core.config import settings
        
        # 1. Determine cursor column for incremental if not passed
        if incremental and not cursor_column:
            for col in ["updated_at", "modified_at", "last_modified", "created_at"]:
                if await self.has_column(table_name, col):
                    cursor_column = col
                    break
        
        # 2. Get row count for adaptive fetch sizing (if not pre-computed)
        if row_count is None:
            row_count = await self.get_row_count(table_name)
        
        fetch_size = self._get_adaptive_fetch_size(row_count)
        chunk_timeout = getattr(settings, 'ETL_CHUNK_TIMEOUT_SECONDS', 30)
        
        # Log for large tables
        if row_count > getattr(settings, 'ETL_LARGE_TABLE_THRESHOLD', 100000):
            logger.info(f"Streaming large table {table_name}: {row_count:,} rows, fetch_size={fetch_size}")
        
        # 3. Build Query
        if "." in table_name:
            s, t = table_name.split(".", 1)
            quoted_table = f'"{s}"."{t}"'
        else:
            quoted_table = f'"{table_name}"'

        if incremental and cursor_column and last_cursor:
            query = f"SELECT * FROM {quoted_table} WHERE {cursor_column} > $1 ORDER BY {cursor_column}"
            params = [datetime.fromisoformat(last_cursor)]
        else:
            query = f"SELECT * FROM {quoted_table}"
            params = []

        # 4. Stream through pool connection with adaptive fetch and timeout
        async with self._get_connection() as conn:
            try:
                async with conn.transaction():
                    cursor = await conn.cursor(query, *params)
                    count = 0
                    while True:
                        try:
                            # Timeout per fetch to detect stuck queries
                            rows = await asyncio.wait_for(
                                cursor.fetch(fetch_size),
                                timeout=chunk_timeout
                            )
                        except asyncio.TimeoutError:
                            logger.error(f"Timeout fetching from {table_name} after {chunk_timeout}s (at row {count})")
                            raise Exception(f"Fetch timeout for {table_name} after {count} rows")
                        
                        if not rows:
                            break
                        for row in rows:
                            record = dict(row)
                            for key, value in record.items():
                                if isinstance(value, datetime):
                                    record[key] = value.isoformat()
                                elif isinstance(value, uuid.UUID):
                                    record[key] = str(value)
                            yield record
                            count += 1
                        
                        # Progress logging every 10k rows
                        if count % 10000 == 0:
                            logger.info(f"Streaming progress for {table_name}: {count:,} / {row_count:,} rows...")
                    
                    logger.info(f"Finished streaming {count:,} rows from {table_name}")
            except Exception as e:
                logger.error(f"Error streaming from {table_name}: {e}")
                raise

    async def extract_table(
        self,
        table_name: str,
        incremental: bool = False,
        last_cursor: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Legacy method for compatibility. 
        Warning: Use stream_table for large tables!
        """
        data = []
        async for record in self.stream_table(table_name, incremental, last_cursor):
            data.append(record)
        
        pk = await self.get_primary_key(table_name)
        return data, pk
    
    async def close(self):
        """Close the pool and tunnel."""
        if self._pool:
            await self._pool.close()
            self._pool = None
        
        if self._tunnel_mgr:
            self._tunnel_mgr.stop()
