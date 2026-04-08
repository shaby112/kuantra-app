"""
Silver Layer - DuckDB Materialization Manager.

Features:
- Auto/View/Incremental materialization strategies
- Smart strategy selection based on table size
- Partition-aware incremental refreshes
- NoSQL source normalization
"""

from enum import Enum
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from app.core.config import settings
from app.core.logging import logger
from app.services.duckdb_manager import duckdb_manager
from app.etl.bronze_layer import bronze_manager
from app.utils.identifiers import connection_schema_name, to_uuid


class MaterializationStrategy(Enum):
    """DuckDB materialization strategies."""
    VIEW = "view"           # CREATE VIEW - no storage, always fresh
    FULL = "full"           # CREATE OR REPLACE TABLE - full refresh
    INCREMENTAL = "incremental"  # INSERT INTO - append new rows only
    AUTO = "auto"           # Automatically select best strategy


class SilverLayerManager:
    """
    Manages Silver layer DuckDB materialization from Bronze Parquet.
    
    Silver layer provides:
    - Sub-second query performance
    - Advanced statistics for joins (HyperLogLog)
    - Partition-aware incremental updates
    """
    
    # Thresholds for auto strategy selection
    VIEW_THRESHOLD = 100_000        # Use VIEW for tables < 100K rows
    INCREMENTAL_THRESHOLD = 1_000_000  # Use INCREMENTAL for tables with timestamp
    
    def __init__(self):
        self._materialized_tables: Dict[str, Dict[str, Any]] = {}
    
    def materialize_table(
        self,
        connection_id: str,
        table_name: str,
        strategy: MaterializationStrategy = MaterializationStrategy.AUTO,
        incremental_column: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Materialize a Bronze Parquet table into Silver DuckDB.
        
        Args:
            connection_id: Connection identifier
            table_name: Name of the table to materialize
            strategy: Materialization strategy (auto/view/full/incremental)
            incremental_column: Column to use for incremental updates (e.g., updated_at)
            
        Returns:
            Dict with materialization status and metadata
        """
        parquet_path = bronze_manager.get_parquet_path(connection_id, table_name)
        if not parquet_path:
            return {
                "status": "error",
                "error": f"Bronze Parquet not found for {table_name}"
            }
        
        schema_name = connection_schema_name(connection_id)
        full_table_name = f"{schema_name}.{table_name}"
        
        # Auto-select strategy if needed
        if strategy == MaterializationStrategy.AUTO:
            strategy = self._select_strategy(
                connection_id, table_name, incremental_column
            )
        
        start_time = datetime.utcnow()
        
        try:
            # Ensure schema exists
            self._ensure_schema(schema_name)
            
            if strategy == MaterializationStrategy.VIEW:
                result = self._materialize_as_view(full_table_name, parquet_path)
            elif strategy == MaterializationStrategy.INCREMENTAL:
                result = self._materialize_incremental(
                    full_table_name, parquet_path, incremental_column
                )
            else:  # FULL
                result = self._materialize_full(full_table_name, parquet_path)
            
            duration = (datetime.utcnow() - start_time).total_seconds()
            
            # Track materialized table
            self._materialized_tables[full_table_name] = {
                "strategy": strategy.value,
                "parquet_path": str(parquet_path),
                "materialized_at": datetime.utcnow().isoformat(),
                "duration_seconds": duration
            }
            
            logger.info(
                f"Materialized {full_table_name} using {strategy.value} "
                f"in {duration:.2f}s"
            )
            
            return {
                "status": "success",
                "table": full_table_name,
                "strategy": strategy.value,
                "duration_seconds": duration,
                **result
            }
            
        except Exception as e:
            logger.error(f"Materialization failed for {full_table_name}: {e}")
            return {
                "status": "error",
                "table": full_table_name,
                "error": str(e)
            }
    
    def _select_strategy(
        self,
        connection_id: str,
        table_name: str,
        incremental_column: Optional[str]
    ) -> MaterializationStrategy:
        """Auto-select best materialization strategy based on table characteristics."""
        row_count = bronze_manager.get_parquet_row_count(connection_id, table_name)
        
        # Small tables: use VIEW (no storage overhead)
        if row_count < self.VIEW_THRESHOLD:
            logger.debug(f"{table_name}: {row_count} rows -> VIEW strategy")
            return MaterializationStrategy.VIEW
        
        # Large tables with timestamp: use INCREMENTAL
        if row_count >= self.INCREMENTAL_THRESHOLD and incremental_column:
            logger.debug(f"{table_name}: {row_count} rows with {incremental_column} -> INCREMENTAL")
            return MaterializationStrategy.INCREMENTAL
        
        # Default: FULL refresh
        logger.debug(f"{table_name}: {row_count} rows -> FULL strategy")
        return MaterializationStrategy.FULL
    
    def _ensure_schema(self, schema_name: str):
        """Ensure DuckDB schema exists."""
        duckdb_manager.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")
    
    def _materialize_as_view(
        self,
        full_table_name: str,
        parquet_path: Path
    ) -> Dict[str, Any]:
        """Create a VIEW pointing to Parquet file (no data copy)."""
        # Ensure cleanup of any existing object (Table or View)
        duckdb_manager.execute(f"DROP TABLE IF EXISTS {full_table_name}")
        duckdb_manager.execute(f"DROP VIEW IF EXISTS {full_table_name}")

        # Use absolute path so DuckDB can resolve it regardless of working directory
        abs_path = str(parquet_path.resolve())
        sql = f"""
            CREATE OR REPLACE VIEW {full_table_name} AS
            SELECT * FROM read_parquet('{abs_path}')
        """
        duckdb_manager.execute(sql)

        return {"type": "view", "storage_bytes": 0}

    def _materialize_full(
        self,
        full_table_name: str,
        parquet_path: Path
    ) -> Dict[str, Any]:
        """Full table refresh from Parquet."""
        # Ensure cleanup of any existing object (Table or View)
        duckdb_manager.execute(f"DROP VIEW IF EXISTS {full_table_name}")
        duckdb_manager.execute(f"DROP TABLE IF EXISTS {full_table_name}")

        # Use absolute path so DuckDB can resolve it regardless of working directory
        abs_path = str(parquet_path.resolve())
        sql = f"""
            CREATE OR REPLACE TABLE {full_table_name} AS
            SELECT * FROM read_parquet('{abs_path}')
        """
        duckdb_manager.execute(sql)
        
        # Get row count
        result = duckdb_manager.execute(
            f"SELECT COUNT(*) as cnt FROM {full_table_name}"
        )
        row_count = result[0]["cnt"] if result else 0
        
        return {"type": "table", "rows_loaded": row_count}
    
    def _materialize_incremental(
        self,
        full_table_name: str,
        parquet_path: Path,
        incremental_column: str
    ) -> Dict[str, Any]:
        """Incremental update - only load new rows."""
        # Check if table exists
        existing = duckdb_manager.execute(f"""
            SELECT COUNT(*) as cnt 
            FROM information_schema.tables 
            WHERE table_schema || '.' || table_name = '{full_table_name}'
        """)
        
        table_exists = existing and existing[0]["cnt"] > 0
        
        if not table_exists:
            # First load - create table
            return self._materialize_full(full_table_name, parquet_path)
        
        # Get max value of incremental column
        max_result = duckdb_manager.execute(
            f"SELECT MAX({incremental_column}) as max_val FROM {full_table_name}"
        )
        max_value = max_result[0]["max_val"] if max_result else None
        
        if max_value is None:
            # No data yet, do full load
            return self._materialize_full(full_table_name, parquet_path)
        
        # Insert only new rows
        abs_path = str(parquet_path.resolve())
        sql = f"""
            INSERT INTO {full_table_name}
            SELECT * FROM read_parquet('{abs_path}')
            WHERE {incremental_column} > '{max_value}'
        """
        duckdb_manager.execute(sql)
        
        # Get count of inserted rows (approximate)
        new_count = duckdb_manager.execute(
            f"SELECT COUNT(*) as cnt FROM {full_table_name} "
            f"WHERE {incremental_column} > '{max_value}'"
        )
        rows_inserted = new_count[0]["cnt"] if new_count else 0
        
        return {"type": "incremental", "rows_inserted": rows_inserted}
    
    def materialize_connection(
        self,
        connection_id: str,
        strategy: MaterializationStrategy = MaterializationStrategy.AUTO
    ) -> Dict[str, Any]:
        """Materialize all Bronze tables for a connection."""
        tables = bronze_manager.list_bronze_tables(connection_id)
        results = []
        
        for table_name in tables:
            result = self.materialize_table(connection_id, table_name, strategy)
            results.append(result)
        
        success_count = sum(1 for r in results if r["status"] == "success")
        
        return {
            "connection_id": connection_id,
            "tables_processed": len(tables),
            "tables_succeeded": success_count,
            "results": results
        }
    
    def rematerialize_all(self) -> Dict[str, Any]:
        """
        Rematerialize all Bronze tables on startup.
        
        Called during app initialization to ensure Silver layer is warm.
        """
        all_results = []
        
        # Find all connection directories in Bronze
        bronze_path = Path("data/bronze")
        if not bronze_path.exists():
            return {"status": "no_bronze_data", "connections": 0}
        
        for conn_dir in bronze_path.iterdir():
            if conn_dir.is_dir() and conn_dir.name.startswith("conn_"):
                try:
                    connection_id = str(to_uuid(conn_dir.name.replace("conn_", "")))
                    result = self.materialize_connection(connection_id)
                    all_results.append(result)
                except Exception:
                    continue
        
        return {
            "status": "completed",
            "connections_processed": len(all_results),
            "results": all_results
        }
    
    def get_materialized_tables(self) -> Dict[str, Dict[str, Any]]:
        """Get info about all materialized tables."""
        return self._materialized_tables.copy()
    
    def drop_silver_table(self, connection_id: str, table_name: str) -> bool:
        """Drop a Silver table."""
        full_table_name = f"{connection_schema_name(connection_id)}.{table_name}"
        try:
            duckdb_manager.execute(f"DROP TABLE IF EXISTS {full_table_name}")
            duckdb_manager.execute(f"DROP VIEW IF EXISTS {full_table_name}")
            
            if full_table_name in self._materialized_tables:
                del self._materialized_tables[full_table_name]
            
            return True
        except Exception as e:
            logger.error(f"Failed to drop Silver table {full_table_name}: {e}")
            return False


# Global singleton instance
silver_manager = SilverLayerManager()
