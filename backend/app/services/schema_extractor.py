from typing import List, Dict, Any
from app.services.duckdb_manager import duckdb_manager

def extract_schema_ddl() -> str:
    """
    Data Privacy Engine: 
    Extracts the schema DDL (tables, columns, types, relationships) 
    WITHOUT touching or exposing any row-level data.
    
    This guarantees that the LLM context window never sees PII or real data.
    """
    tables = duckdb_manager.get_tables()
    ddl_lines = ["-- Kuantra Semantic Model Schema", "-- DO NOT USE ROW DATA; ONLY USE STRUCTURE", ""]
    
    for table in tables:
        schema = duckdb_manager.get_table_schema(table)
        
        ddl_lines.append(f"CREATE TABLE {table} (")
        col_defs = []
        for col in schema:
            col_name = col.get("column_name", col.get("name", "unknown"))
            col_type = col.get("data_type", col.get("type", "VARCHAR"))
            col_defs.append(f"    {col_name} {col_type}")
        
        ddl_lines.append(",\n".join(col_defs))
        ddl_lines.append(");")
        ddl_lines.append("")
        
    return "\n".join(ddl_lines)
