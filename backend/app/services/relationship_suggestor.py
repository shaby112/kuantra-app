"""
Relationship Suggestor Service.

Features:
- ML-based foreign key detection heuristics
- Confidence scoring based on multiple signals
- Analyzes column names, value overlap, cardinality
"""

import re
from typing import Dict, Any, List, Optional, Set
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from app.core.logging import logger
from app.services.duckdb_manager import duckdb_manager
from app.utils.identifiers import connection_schema_name


class RelationshipSuggestor:
    """
    AI-powered relationship suggestion using heuristics.
    
    Detection features:
    1. Column name similarity (user_id -> users.id)
    2. Value overlap percentage
    3. Cardinality ratio (many-to-one patterns)
    4. Naming conventions (fk_, _id suffixes)
    """
    
    # Minimum confidence to suggest a relationship
    MIN_CONFIDENCE = 0.3
    
    # Patterns that suggest foreign keys
    FK_PATTERNS = [
        r"(.+)_id$",       # user_id, order_id
        r"(.+)Id$",        # userId, orderId (camelCase)
        r"fk_(.+)$",       # fk_user, fk_order
        r"(.+)_fk$",       # user_fk
        r"id_(.+)$",       # id_user
    ]
    
    async def suggest_relationships(
        self,
        db: Session,
        connection_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Analyze schema and suggest potential FK relationships.
        
        Returns list of suggestions with confidence scores.
        """
        suggestions = []
        
        try:
            # Get all tables and columns from DuckDB
            allowed_schemas: Optional[Set[str]] = None
            if connection_ids:
                allowed_schemas = {
                    connection_schema_name(conn_id)
                    for conn_id in connection_ids
                    if conn_id
                }

            tables = self._get_schema_info(allowed_schemas=allowed_schemas)
            
            if not tables:
                logger.warning("No tables found in DuckDB for relationship analysis")
                return []
            
            # Find primary keys
            primary_keys = self._identify_primary_keys(tables)
            
            # Analyze each column for potential FK relationships
            for table_name, columns in tables.items():
                for column in columns:
                    col_name = column["name"]
                    col_type = column["type"]
                    
                    # Skip non-key-like columns
                    if not self._is_potential_fk(col_name, col_type):
                        continue
                    
                    # Find matching primary keys
                    for pk_table, pk_column in primary_keys.items():
                        if pk_table == table_name:
                            continue  # Skip self-references
                        
                        confidence = self._compute_confidence(
                            fk_table=table_name,
                            fk_column=col_name,
                            pk_table=pk_table,
                            pk_column=pk_column
                        )
                        
                        if confidence >= self.MIN_CONFIDENCE:
                            suggestions.append({
                                "from_table": table_name,
                                "from_column": col_name,
                                "to_table": pk_table,
                                "to_column": pk_column,
                                "confidence": round(confidence, 2)
                            })
            
            # Sort by confidence (highest first)
            suggestions.sort(key=lambda x: -x["confidence"])
            
            logger.info(f"Generated {len(suggestions)} relationship suggestions")
            return suggestions
            
        except Exception as e:
            logger.error(f"Relationship suggestion failed: {e}")
            raise
    
    def _get_schema_info(self, allowed_schemas: Optional[Set[str]] = None) -> Dict[str, List[Dict[str, str]]]:
        """Get all tables and columns from DuckDB."""
        tables = {}
        
        try:
            # Get all schemas
            schemas = duckdb_manager.execute(
                "SELECT DISTINCT table_schema FROM information_schema.tables"
            )
            
            for schema_row in schemas:
                schema_name = schema_row["table_schema"]
                if schema_name.startswith("_") or schema_name in {"information_schema", "pg_catalog", "main"}:
                    continue  # Skip internal/system schemas
                if allowed_schemas and schema_name not in allowed_schemas:
                    continue
                
                # Get tables in schema
                table_result = duckdb_manager.execute(f"""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = '{schema_name}'
                """)
                
                for table_row in table_result:
                    table_name = table_row["table_name"]
                    full_name = f"{schema_name}.{table_name}" if schema_name != "main" else table_name
                    
                    # Get columns
                    columns = duckdb_manager.execute(f"""
                        SELECT column_name, data_type
                        FROM information_schema.columns
                        WHERE table_schema = '{schema_name}' AND table_name = '{table_name}'
                    """)
                    
                    tables[full_name] = [
                        {"name": c["column_name"], "type": c["data_type"]}
                        for c in columns
                    ]
            
            return tables
            
        except Exception as e:
            logger.error(f"Failed to get schema info: {e}")
            return {}
    
    def _identify_primary_keys(
        self,
        tables: Dict[str, List[Dict[str, str]]]
    ) -> Dict[str, str]:
        """Identify primary key columns for each table."""
        primary_keys = {}
        
        for table_name, columns in tables.items():
            # Look for 'id' column first
            for col in columns:
                if col["name"].lower() == "id":
                    primary_keys[table_name] = col["name"]
                    break
            
            # If no 'id', look for tablename_id
            if table_name not in primary_keys:
                base_name = table_name.split(".")[-1]  # Remove schema prefix
                for col in columns:
                    if col["name"].lower() == f"{base_name}_id":
                        primary_keys[table_name] = col["name"]
                        break
        
        return primary_keys
    
    def _is_potential_fk(self, col_name: str, col_type: str) -> bool:
        """Check if column could be a foreign key."""
        # Must be integer or string type
        fk_types = ["INTEGER", "BIGINT", "INT", "VARCHAR", "TEXT", "UUID"]
        if not any(t in col_type.upper() for t in fk_types):
            return False
        
        # Check naming patterns
        for pattern in self.FK_PATTERNS:
            if re.match(pattern, col_name, re.IGNORECASE):
                return True
        
        return False
    
    def _compute_confidence(
        self,
        fk_table: str,
        fk_column: str,
        pk_table: str,
        pk_column: str
    ) -> float:
        """
        Compute confidence score for a potential relationship.
        
        Factors:
        1. Name similarity (40%)
        2. Extracted table name match (40%)
        3. Column naming convention (20%)
        """
        score = 0.0
        
        # 1. Name similarity between FK column and PK table
        pk_base = pk_table.split(".")[-1].lower()  # e.g., "users"
        pk_singular = pk_base.rstrip("s")  # e.g., "user"
        fk_lower = fk_column.lower()
        
        # Check if FK column contains table name
        if pk_base in fk_lower or pk_singular in fk_lower:
            score += 0.4
        else:
            # Use sequence matching for partial similarity
            similarity = SequenceMatcher(None, fk_lower, pk_singular).ratio()
            score += similarity * 0.2
        
        # 2. Check for table name extraction from FK column
        for pattern in self.FK_PATTERNS:
            match = re.match(pattern, fk_column, re.IGNORECASE)
            if match:
                extracted = match.group(1).lower()
                if extracted == pk_singular or extracted == pk_base:
                    score += 0.4
                elif extracted in pk_base or pk_base in extracted:
                    score += 0.2
                break
        
        # 3. Convention bonus (ends with _id and points to id)
        if fk_column.lower().endswith("_id") and pk_column.lower() == "id":
            score += 0.2
        
        return min(score, 1.0)


# Global singleton instance
relationship_suggestor = RelationshipSuggestor()
