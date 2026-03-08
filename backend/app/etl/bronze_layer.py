"""
Bronze Layer - Parquet Exporter and Schema Change Detection.

Features:
- Export DuckDB tables to Bronze Parquet files
- Detect schema changes between syncs
- Apply dlt schema contract strategies (evolve/freeze)
"""

import os
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from enum import Enum

import polars as pl

from app.core.config import settings
from app.core.logging import logger
from app.utils.identifiers import connection_schema_name


class SchemaChangeType(Enum):
    """Types of schema changes."""
    COLUMN_ADDED = "column_added"
    COLUMN_REMOVED = "column_removed"
    COLUMN_RENAMED = "column_renamed"
    TYPE_CHANGED = "type_changed"
    NO_CHANGE = "no_change"


class SchemaChange:
    """Represents a single schema change."""
    
    def __init__(
        self,
        change_type: SchemaChangeType,
        table_name: str,
        column_name: str,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None
    ):
        self.change_type = change_type
        self.table_name = table_name
        self.column_name = column_name
        self.old_value = old_value
        self.new_value = new_value
        self.detected_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "change_type": self.change_type.value,
            "table_name": self.table_name,
            "column_name": self.column_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "detected_at": self.detected_at.isoformat()
        }
    
    @property
    def requires_review(self) -> bool:
        """Check if this change requires user review."""
        return self.change_type in [
            SchemaChangeType.COLUMN_REMOVED,
            SchemaChangeType.COLUMN_RENAMED,
            SchemaChangeType.TYPE_CHANGED
        ]


class BronzeLayerManager:
    """
    Manages Bronze layer Parquet storage and schema evolution.
    
    Bronze layer stores raw data in Parquet format for:
    - Version-agnostic portability
    - Schema evolution tracking
    - Disaster recovery
    """
    
    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path or settings.BRONZE_BASE_PATH)
        self.schema_history_path = self.base_path / "_schema_history"
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Create Bronze directories if they don't exist."""
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.schema_history_path.mkdir(parents=True, exist_ok=True)
    
    def get_connection_path(self, connection_id: str) -> Path:
        """Get Bronze storage path for a connection."""
        path = self.base_path / connection_schema_name(connection_id)
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def export_to_parquet(
        self,
        connection_id: str,
        table_name: str,
        data: List[Dict[str, Any]]
    ) -> Tuple[Path, List[SchemaChange]]:
        """
        Export table data to Bronze Parquet file.
        
        Args:
            connection_id: Connection identifier
            table_name: Name of the table
            data: List of records to export
            
        Returns:
            Tuple of (parquet_path, list of schema changes)
        """
        if not data:
            logger.warning(f"No data to export for {table_name}")
            return None, []
        
        conn_path = self.get_connection_path(connection_id)
        parquet_path = conn_path / f"{table_name}.parquet"
        
        # Detect schema changes before overwriting
        schema_changes = []
        if parquet_path.exists():
            schema_changes = self._detect_schema_changes(
                connection_id, table_name, data
            )
        
        # Convert to Polars DataFrame and write Parquet
        try:
            df = pl.DataFrame(data)
            df.write_parquet(
                parquet_path,
                compression="snappy",  # Fast compression, good balance
                statistics=True  # Enable column statistics for query optimization
            )
            
            logger.info(
                f"Exported {len(data)} rows to Bronze: {parquet_path}"
            )
            
            # Save current schema for future comparison
            self._save_schema_snapshot(connection_id, table_name, df.schema)
            
            return parquet_path, schema_changes
            
        except Exception as e:
            logger.error(f"Failed to export {table_name} to Parquet: {e}")
            raise
    
    def _detect_schema_changes(
        self,
        connection_id: str,
        table_name: str,
        new_data: List[Dict[str, Any]]
    ) -> List[SchemaChange]:
        """
        Detect schema changes between existing Parquet and new data.
        
        Implements dlt-style schema contract detection:
        - COLUMN_ADDED: Auto-evolve (allowed)
        - COLUMN_REMOVED: Requires review
        - TYPE_CHANGED: Freeze (blocked until confirmed)
        """
        changes = []
        
        # Load existing schema
        existing_schema = self._load_schema_snapshot(connection_id, table_name)
        if not existing_schema:
            return changes  # First sync, no changes to detect
        
        # Infer new schema from data
        if not new_data:
            return changes
        
        new_df = pl.DataFrame(new_data[:1])  # Sample first row for schema
        new_schema = {name: str(dtype) for name, dtype in new_df.schema.items()}
        
        existing_columns = set(existing_schema.keys())
        new_columns = set(new_schema.keys())
        
        # Detect added columns (evolve - allowed)
        for col in new_columns - existing_columns:
            changes.append(SchemaChange(
                change_type=SchemaChangeType.COLUMN_ADDED,
                table_name=table_name,
                column_name=col,
                new_value=new_schema[col]
            ))
        
        # Detect removed columns (requires review)
        for col in existing_columns - new_columns:
            changes.append(SchemaChange(
                change_type=SchemaChangeType.COLUMN_REMOVED,
                table_name=table_name,
                column_name=col,
                old_value=existing_schema[col]
            ))
        
        # Detect type changes (freeze - blocked)
        for col in existing_columns & new_columns:
            if existing_schema[col] != new_schema[col]:
                changes.append(SchemaChange(
                    change_type=SchemaChangeType.TYPE_CHANGED,
                    table_name=table_name,
                    column_name=col,
                    old_value=existing_schema[col],
                    new_value=new_schema[col]
                ))
        
        # Log changes
        if changes:
            logger.info(f"Schema changes detected for {table_name}: {len(changes)}")
            for change in changes:
                logger.info(f"  - {change.change_type.value}: {change.column_name}")
        
        return changes
    
    def _save_schema_snapshot(
        self,
        connection_id: str,
        table_name: str,
        schema: Dict[str, Any]
    ):
        """Save schema snapshot for future comparison."""
        schema_file = self.schema_history_path / f"{connection_schema_name(connection_id)}_{table_name}.json"
        
        schema_data = {
            "schema": {name: str(dtype) for name, dtype in schema.items()},
            "updated_at": datetime.utcnow().isoformat()
        }
        
        with open(schema_file, "w") as f:
            json.dump(schema_data, f, indent=2)
    
    def _load_schema_snapshot(
        self,
        connection_id: str,
        table_name: str
    ) -> Optional[Dict[str, str]]:
        """Load previously saved schema snapshot."""
        schema_file = self.schema_history_path / f"{connection_schema_name(connection_id)}_{table_name}.json"
        
        if not schema_file.exists():
            return None
        
        try:
            with open(schema_file, "r") as f:
                data = json.load(f)
            return data.get("schema", {})
        except Exception as e:
            logger.warning(f"Failed to load schema snapshot: {e}")
            return None
    
    def get_parquet_path(self, connection_id: str, table_name: str) -> Optional[Path]:
        """Get path to existing Parquet file."""
        path = self.get_connection_path(connection_id) / f"{table_name}.parquet"
        return path if path.exists() else None
    
    def list_bronze_tables(self, connection_id: str) -> List[str]:
        """List all Bronze tables for a connection."""
        conn_path = self.get_connection_path(connection_id)
        return [
            f.stem for f in conn_path.glob("*.parquet")
        ]
    
    def get_parquet_row_count(self, connection_id: str, table_name: str) -> int:
        """Get row count from Parquet file without loading all data."""
        parquet_path = self.get_parquet_path(connection_id, table_name)
        if not parquet_path:
            return 0
        
        try:
            # Use lazy scan to get count efficiently
            return pl.scan_parquet(parquet_path).select(pl.count()).collect()[0, 0]
        except Exception as e:
            logger.error(f"Failed to get row count: {e}")
            return 0
    
    def read_parquet(
        self,
        connection_id: str,
        table_name: str,
        columns: Optional[List[str]] = None,
        limit: Optional[int] = None
    ) -> Optional[pl.DataFrame]:
        """
        Read Parquet file with optional column selection and limit.
        
        Uses lazy evaluation for efficiency.
        """
        parquet_path = self.get_parquet_path(connection_id, table_name)
        if not parquet_path:
            return None
        
        try:
            lf = pl.scan_parquet(parquet_path)
            
            if columns:
                lf = lf.select(columns)
            
            if limit:
                lf = lf.head(limit)
            
            return lf.collect()
        except Exception as e:
            logger.error(f"Failed to read Parquet: {e}")
            return None
    
    def delete_bronze_table(self, connection_id: str, table_name: str) -> bool:
        """Delete a Bronze Parquet file."""
        parquet_path = self.get_parquet_path(connection_id, table_name)
        if parquet_path and parquet_path.exists():
            parquet_path.unlink()
            logger.info(f"Deleted Bronze table: {parquet_path}")
            return True
        return False
    
    def delete_connection_bronze(self, connection_id: str) -> bool:
        """Delete all Bronze data for a connection."""
        import shutil
        
        conn_path = self.get_connection_path(connection_id)
        if conn_path.exists():
            shutil.rmtree(conn_path)
            logger.info(f"Deleted Bronze data for connection {connection_id}")
            return True
        return False


# Global singleton instance
bronze_manager = BronzeLayerManager()
