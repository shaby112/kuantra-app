from typing import Dict, Any, List
from app.services.semantic_model_service import semantic_model_service

def get_semantic_model(connection_ids: List[str] = None) -> Dict[str, Any]:
    """
    Retrieves the Semantic Model (MDL) for the connected data sources.
    
    The MDL contains:
    - Models (Tables): Names, columns, types, primary keys.
    - Relationships: Foreign keys and detected joins between tables.
    - Statistics: Cardinality, null percentages, min/max values for columns.
    - Computed Columns: Derived metrics (e.g. profit = revenue - cost).
    
    Args:
        connection_ids: Optional list of connection IDs to filter by. If None, semantic model for all synced connections is returned.
        
    Returns:
        A dictionary containing the full MDL.
    """
    # Unified semantic model access path used across chat, dashboards, and analyst flows.
    return semantic_model_service.get_current(connection_ids=connection_ids)
