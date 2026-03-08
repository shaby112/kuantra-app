"""
MySQL Source Connector.

Features:
- Connection using pymysql (sync, wrapped for async)
- Schema discovery
- Incremental extraction
"""

from typing import Dict, Any, List, Optional, Tuple, AsyncGenerator
from datetime import datetime
import asyncio
import uuid

from app.db.models import DbConnection
from app.utils.crypto import crypto_service
from app.core.logging import logger


class MySQLSource:
    """MySQL data source connector."""
    
    def __init__(self, connection: DbConnection):
        self.connection = connection
        self._conn = None
        from app.utils.ssh_tunnel import SSHTunnelManager
        self._tunnel_mgr = SSHTunnelManager(connection)
        self._tunnel = None
    
    def _get_connection(self):
        """Get a fresh pymysql connection."""
        import pymysql
        
        password = None
        if self.connection.encrypted_password:
            password = crypto_service.decrypt(self.connection.encrypted_password)
        
        host = self.connection.host
        port = self.connection.port or 3306
        
        if self.connection.use_ssh_tunnel:
            # Tunnel manager handles re-entrance/persistence
            # If tunnel is not started, it will start. If started, it returns current.
            # Wait, our SSHTunnelManager.start() starts a NEW one every time if not careful.
            # Actually, let's check SSHTunnelManager again.
            if not self._tunnel:
                self._tunnel, host, port = self._tunnel_mgr.start()
            else:
                host = '127.0.0.1'
                port = self._tunnel.local_bind_port

        conn = pymysql.connect(
            host=host,
            port=port,
            user=self.connection.username,
            password=password,
            database=self.connection.database_name,
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=10
        )
        
        return conn
    
    async def get_tables(self) -> List[str]:
        """Get list of tables."""
        def _get():
            conn = self._get_connection()
            try:
                with conn.cursor() as cursor:
                    cursor.execute("SHOW TABLES")
                    rows = cursor.fetchall()
                    return [list(row.values())[0] for row in rows]
            finally:
                conn.close()
        
        return await asyncio.to_thread(_get)
    
    async def get_primary_key(self, table_name: str) -> Optional[str]:
        """Get primary key column for a table."""
        def _get():
            conn = self._get_connection()
            try:
                with conn.cursor() as cursor:
                    cursor.execute(f"""
                        SELECT COLUMN_NAME 
                        FROM information_schema.KEY_COLUMN_USAGE 
                        WHERE TABLE_SCHEMA = %s
                        AND TABLE_NAME = %s 
                        AND CONSTRAINT_NAME = 'PRIMARY'
                        LIMIT 1
                    """, (self.connection.database_name, table_name))
                    row = cursor.fetchone()
                    return row["COLUMN_NAME"] if row else None
            finally:
                conn.close()
        
        return await asyncio.to_thread(_get)
    
    async def has_column(self, table_name: str, column_name: str) -> bool:
        """Check if a table has a specific column."""
        def _check():
            conn = self._get_connection()
            try:
                with conn.cursor() as cursor:
                    cursor.execute(f"""
                        SELECT COUNT(*) as cnt
                        FROM information_schema.COLUMNS 
                        WHERE TABLE_SCHEMA = %s
                        AND TABLE_NAME = %s 
                        AND COLUMN_NAME = %s
                    """, (self.connection.database_name, table_name, column_name))
                    row = cursor.fetchone()
                    return row["cnt"] > 0
            finally:
                conn.close()
        
        return await asyncio.to_thread(_check)
    
    async def stream_table(
        self,
        table_name: str,
        incremental: bool = False,
        last_cursor: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream data from MySQL table."""
        # Bridging sync pymysql to async generator
        import queue
        import threading

        q = queue.Queue(maxsize=1000)
        done = threading.Event()

        def _worker():
            try:
                conn = self._get_connection()
                # Get cursor column
                cursor_column = None
                if incremental:
                    for col in ["updated_at", "modified_at", "last_modified", "created_at"]:
                        with conn.cursor() as cursor:
                            cursor.execute(f"SHOW COLUMNS FROM `{table_name}` LIKE %s", (col,))
                            if cursor.fetchone():
                                cursor_column = col
                                break
                
                with conn.cursor() as cursor:
                    if incremental and cursor_column and last_cursor:
                        cursor.execute(
                            f"SELECT * FROM `{table_name}` WHERE `{cursor_column}` > %s ORDER BY `{cursor_column}`",
                            (last_cursor,)
                        )
                    else:
                        cursor.execute(f"SELECT * FROM `{table_name}`")
                    
                    while True:
                        row = cursor.fetchone()
                        if not row:
                            break
                        
                        record = dict(row)
                        for key, value in record.items():
                            if isinstance(value, datetime):
                                record[key] = value.isoformat()
                            elif isinstance(value, uuid.UUID):
                                record[key] = str(value)
                        
                        q.put(record)
            except Exception as e:
                q.put(e)
            finally:
                if 'conn' in locals():
                    conn.close()
                done.set()

        thread = threading.Thread(target=_worker)
        thread.start()

        while not done.is_set() or not q.empty():
            try:
                item = q.get_nowait()
                if isinstance(item, Exception):
                    raise item
                yield item
            except queue.Empty:
                await asyncio.sleep(0.01)

    async def extract_table(
        self,
        table_name: str,
        incremental: bool = False,
        last_cursor: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Legacy method."""
        data = []
        async for record in self.stream_table(table_name, incremental, last_cursor):
            data.append(record)
        pk = await self.get_primary_key(table_name)
        return data, pk
    
    async def close(self):
        """Close the connection and tunnel."""
        if self._conn:
            self._conn.close()
            self._conn = None
            
        if self._tunnel_mgr:
            self._tunnel_mgr.stop()
