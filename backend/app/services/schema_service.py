from typing import Dict, Any
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.services.semantic_model_service import semantic_model_service

class SchemaService:
    """
    Automatically infers and updates the Semantic Model (MDL) from the live data warehouse.
    Delegates lifecycle operations to SemanticModelService.
    """
    
    def __init__(self, mdl_path: str = "app/semantic/model.mdl"):
        self.mdl_path = mdl_path

    def refresh_mdl(self, db: Session) -> Dict[str, Any]:
        """
        Backward-compatible wrapper around SemanticModelService refresh.
        """
        try:
            mdl_content = semantic_model_service.refresh(
                db=db,
                created_by=None,
                change_summary="Automatic schema refresh (Enhanced v2)",
            )
            logger.info("MDL updated via SemanticModelService.")
            return mdl_content
            
        except Exception as e:
            logger.error(f"Failed to refresh MDL: {e}", exc_info=True)
            return {}

# Global instance
schema_service = SchemaService()
