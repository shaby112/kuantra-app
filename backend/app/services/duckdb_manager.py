"""
Enterprise-grade DuckDB connection manager.

Features:
- Thread-safe connection pooling using cursor()
- Environment-based memory configuration
- Disk spillover for large datasets
- Health monitoring support
"""

import os
import threading
import duckdb
from typing import Dict, Any, Optional, List
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger


class DuckDBManager:
    """
    Thread-safe DuckDB connection manager for enterprise deployments.
    
    Uses a single persistent connection with thread-local cursors
    following DuckDB's recommended pattern for multi-threaded access.
    """
    
    _instance: Optional["DuckDBManager"] = None
    _lock = threading.Lock()
    
    def __new__(cls) -> "DuckDBManager":
        """Singleton pattern for global access."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._connection: Optional[duckdb.DuckDBPyConnection] = None
        self._config = self._build_config()
        self._initialized = True
        
        # Ensure data directories exist
        self._ensure_directories()
        
        # Initialize connection
        self._init_connection()
        
        logger.info(f"DuckDB Manager initialized: {self._config}")
    
    def _build_config(self) -> Dict[str, Any]:
        """Build configuration from environment variables."""
        return {
            "database_path": getattr(settings, "DUCKDB_DATABASE_PATH", "data/warehouse.duckdb"),
            "memory_limit": getattr(settings, "DUCKDB_MEMORY_LIMIT", "60%"),
            "temp_directory": getattr(settings, "DUCKDB_TEMP_DIR", "data/duckdb_temp"),
            "threads": getattr(settings, "DUCKDB_THREADS", 4),
            "preserve_insertion_order": getattr(settings, "DUCKDB_PRESERVE_ORDER", False),
        }
    
    def _ensure_directories(self):
        """Create necessary directories."""
        db_path = Path(self._config["database_path"])
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        temp_path = Path(self._config["temp_directory"])
        temp_path.mkdir(parents=True, exist_ok=True)
    
    def _init_connection(self):
        """Initialize the DuckDB connection with enterprise settings."""
        try:
            self._connection = duckdb.connect(
                database=self._config["database_path"],
                read_only=False
            )
            
            # Apply performance configurations
            self._connection.execute(f"SET memory_limit = '{self._config['memory_limit']}'")
            self._connection.execute(f"SET temp_directory = '{self._config['temp_directory']}'")
            self._connection.execute(f"SET threads = {self._config['threads']}")
            self._connection.execute(f"SET preserve_insertion_order = {str(self._config['preserve_insertion_order']).lower()}")
            
            # Enable progress bar for long operations
            self._connection.execute("SET enable_progress_bar = true")
            
            logger.info("DuckDB connection established successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize DuckDB: {e}")
            raise
    
    def get_cursor(self) -> duckdb.DuckDBPyConnection:
        """
        Get a thread-local cursor for concurrent queries.
        
        Each thread should use its own cursor to ensure thread safety.
        The cursor shares the same database connection.
        """
        if self._connection is None:
            self._init_connection()
        return self._connection.cursor()
    
    def execute(self, sql: str, params: tuple = None) -> List[Dict[str, Any]]:
        """
        Execute a SQL query and return results as list of dicts.
        
        Thread-safe execution using a dedicated cursor.
        """
        cursor = self.get_cursor()
        try:
            if params:
                result = cursor.execute(sql, params)
            else:
                result = cursor.execute(sql)
            
            # Fetch results if it's a SELECT
            if result.description:
                columns = [desc[0] for desc in result.description]
                rows = result.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            return []
        finally:
            cursor.close()
    
    def get_tables(self) -> List[str]:
        """Get list of all tables in the warehouse."""
        cursor = self.get_cursor()
        try:
            result = cursor.execute("SHOW TABLES").fetchall()
            return [row[0] for row in result]
        finally:
            cursor.close()
    
    def get_table_schema(self, table_name: str) -> List[Dict[str, str]]:
        """Get schema for a specific table."""
        cursor = self.get_cursor()
        try:
            result = cursor.execute(f"DESCRIBE {table_name}").fetchdf()
            return result.to_dict(orient="records")
        finally:
            cursor.close()
    
    def get_table_row_count(self, table_name: str) -> int:
        """Get row count for a table."""
        cursor = self.get_cursor()
        try:
            result = cursor.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()
            return result[0] if result else 0
        finally:
            cursor.close()
    
    def drop_table(self, table_name: str) -> bool:
        """Drop a table from the warehouse."""
        cursor = self.get_cursor()
        try:
            cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
            logger.info(f"Dropped table: {table_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to drop table {table_name}: {e}")
            return False
        finally:
            cursor.close()
    
    def drop_schema(self, schema_name: str) -> None:
        """
        Drop an entire schema and all its tables.
        This is used for hard resets when schema conflicts occur.
        """
        cursor = self.get_cursor()
        try:
            # Drop all tables in the schema first (if cascade is not supported/wanted)
            # Depending on DuckDB version, DROP SCHEMA CASCADE might be supported.
            # Using CASCADE is safer to clean up everything.
            cursor.execute(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE;")
            logger.info(f"Dropped schema {schema_name}")
        except Exception as e:
            logger.error(f"Failed to drop schema {schema_name}: {e}")
            raise
        finally:
            cursor.close()

    def health_check(self) -> Dict[str, Any]:
        """
        Health check for monitoring endpoints.
        
        Returns database status, memory usage, and table counts.
        """
        try:
            cursor = self.get_cursor()
            
            # Get database size
            db_path = Path(self._config["database_path"])
            db_size_mb = db_path.stat().st_size / (1024 * 1024) if db_path.exists() else 0
            
            # Get table count
            tables = self.get_tables()
            
            # Get memory info
            memory_info = cursor.execute("SELECT current_setting('memory_limit')").fetchone()
            
            cursor.close()
            
            return {
                "status": "healthy",
                "database_path": str(db_path),
                "database_size_mb": round(db_size_mb, 2),
                "table_count": len(tables),
                "tables": tables[:10],  # First 10 tables
                "memory_limit": memory_info[0] if memory_info else "unknown",
                "temp_directory": self._config["temp_directory"],
            }
        except Exception as e:
            logger.error(f"DuckDB health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    def cleanup_temp(self):
        """Clean up temporary files."""
        temp_path = Path(self._config["temp_directory"])
        if temp_path.exists():
            import shutil
            for item in temp_path.iterdir():
                try:
                    if item.is_file():
                        item.unlink()
                    elif item.is_dir():
                        shutil.rmtree(item)
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp item {item}: {e}")
    
    def close(self):
        """Close the connection gracefully."""
        if self._connection:
            try:
                self._connection.close()
                self._connection = None
                logger.info("DuckDB connection closed")
            except Exception as e:
                logger.error(f"Error closing DuckDB connection: {e}")


# Global singleton instance
duckdb_manager = DuckDBManager()
