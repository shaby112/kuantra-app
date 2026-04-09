"""
Semantic Layer API Endpoints.

Features:
- GET/PUT MDL with versioning
- Optimistic locking for concurrent edits
- Relationship suggestion with confidence scores
- User confirmation workflow
"""

from typing import Any, List, Optional, Dict
from datetime import datetime, timedelta
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.api import deps
from app.db.models import User, MDLVersion, MDLLock, SuggestedRelationship, DbConnection, SyncConfig
from app.core.logging import logger
from app.utils.identifiers import connection_schema_name


router = APIRouter()


# === Pydantic Schemas ===

class MDLResponse(BaseModel):
    version: int
    content: Dict[str, Any]
    user_overrides: Dict[str, Any]
    created_at: datetime
    created_by: Optional[str]
    is_locked: bool
    locked_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class MDLUpdateRequest(BaseModel):
    content: Dict[str, Any]
    change_summary: Optional[str] = None
    base_version: int


class RelationshipSuggestion(BaseModel):
    id: str
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    confidence: float
    status: str
    
    class Config:
        from_attributes = True


class RelationshipConfirmRequest(BaseModel):
    relationship_id: UUID
    action: str = Field(..., pattern="^(confirm|reject)$")


class LockResponse(BaseModel):
    acquired: bool
    expires_at: Optional[datetime] = None
    locked_by: Optional[str] = None


class ManualRelationshipRequest(BaseModel):
    """Request for manually creating a relationship."""
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    join_type: str = Field(default="many_to_one", pattern="^(one_to_one|one_to_many|many_to_one|many_to_many)$")


# === Helper Functions ===

def get_current_mdl(db: Session) -> Optional[MDLVersion]:
    """Get the latest MDL version."""
    return db.query(MDLVersion).order_by(MDLVersion.version.desc()).first()


def check_lock(db: Session) -> Optional[MDLLock]:
    """Check if there's an active (non-expired) lock."""
    now = datetime.utcnow()
    return db.query(MDLLock).filter(MDLLock.expires_at > now).first()


def release_expired_locks(db: Session):
    """Clean up expired locks."""
    now = datetime.utcnow()
    db.query(MDLLock).filter(MDLLock.expires_at <= now).delete()
    db.commit()


# === Endpoints ===

@router.get("/mdl", response_model=MDLResponse)
def get_mdl(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get the current MDL (Modeling Definition Language) content.
    
    Returns the latest version with lock status.
    """
    release_expired_locks(db)
    
    mdl = get_current_mdl(db)
    if not mdl:
        # Return empty MDL if none exists
        return {
            "version": 0,
            "content": {"models": [], "relationships": []},
            "user_overrides": {},
            "created_at": datetime.utcnow(),
            "created_by": None,
            "is_locked": False,
            "locked_by": None
        }
    
    # Check lock status
    lock = check_lock(db)
    locked_by = None
    if lock:
        lock_user = db.query(User).filter(User.id == lock.user_id).first()
        locked_by = lock_user.username if lock_user else "Unknown"
    
    return {
        "version": mdl.version,
        "content": mdl.content,
        "user_overrides": mdl.user_overrides or {},
        "created_at": mdl.created_at,
        "created_by": str(mdl.created_by) if mdl.created_by else None,
        "is_locked": lock is not None and lock.user_id != current_user.id,
        "locked_by": locked_by
    }


@router.put("/mdl", response_model=MDLResponse)
def update_mdl(
    request: MDLUpdateRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Update the MDL content.
    
    Creates a new version. Requires lock or no active lock.
    """
    release_expired_locks(db)
    
    # Check for conflicting lock
    lock = check_lock(db)
    if lock and lock.user_id != current_user.id:
        lock_user = db.query(User).filter(User.id == lock.user_id).first()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"MDL is locked by {lock_user.username if lock_user else 'another user'}"
        )
    
    # Get current version
    current_mdl = get_current_mdl(db)
    current_version = current_mdl.version if current_mdl else 0
    
    # Optimistic Lock Check
    if request.base_version != current_version:
        # User is editing an old version. Return conflict with latest data.
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": "Version conflict",
                "latest": {
                    "version": current_version,
                    "content": current_mdl.content if current_mdl else {},
                    "user_overrides": current_mdl.user_overrides if current_mdl else {},
                    "created_at": current_mdl.created_at.isoformat() if current_mdl else None,
                    "created_by": str(current_mdl.created_by) if current_mdl and current_mdl.created_by else None
                }
            }
        )
    
    # Preserve user overrides from previous version
    user_overrides = current_mdl.user_overrides if current_mdl else {}
    
    # Create new version
    new_mdl = MDLVersion(
        version=current_version + 1,
        content=request.content,
        user_overrides=user_overrides,
        created_by=current_user.id,
        change_summary=request.change_summary
    )
    
    db.add(new_mdl)
    
    # Release user's lock if they had one
    if lock and lock.user_id == current_user.id:
        db.delete(lock)
    
    db.commit()
    db.refresh(new_mdl)
    
    logger.info(f"MDL updated to version {new_mdl.version} by user {current_user.id}")
    
    return {
        "version": new_mdl.version,
        "content": new_mdl.content,
        "user_overrides": new_mdl.user_overrides or {},
        "created_at": new_mdl.created_at,
        "created_by": str(new_mdl.created_by) if new_mdl.created_by else None,
        "is_locked": False,
        "locked_by": None
    }


@router.post("/mdl/lock", response_model=LockResponse)
def acquire_lock(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Acquire a lock on the MDL for editing.
    
    Lock expires after 5 minutes.
    """
    release_expired_locks(db)
    
    # Check for existing lock
    existing_lock = check_lock(db)
    if existing_lock:
        if existing_lock.user_id == current_user.id:
            # Extend their own lock
            existing_lock.expires_at = datetime.utcnow() + timedelta(minutes=5)
            db.commit()
            return {
                "acquired": True,
                "expires_at": existing_lock.expires_at,
                "locked_by": current_user.username
            }
        else:
            lock_user = db.query(User).filter(User.id == existing_lock.user_id).first()
            return {
                "acquired": False,
                "expires_at": existing_lock.expires_at,
                "locked_by": lock_user.username if lock_user else "Unknown"
            }
    
    # Create new lock
    lock = MDLLock(
        user_id=current_user.id,
        expires_at=datetime.utcnow() + timedelta(minutes=5)
    )
    db.add(lock)
    db.commit()
    db.refresh(lock)
    
    return {
        "acquired": True,
        "expires_at": lock.expires_at,
        "locked_by": current_user.username
    }


@router.delete("/mdl/lock")
def release_lock(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Release the current user's lock."""
    db.query(MDLLock).filter(MDLLock.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Lock released"}


@router.get("/mdl/history")
def get_mdl_history(
    limit: int = 20,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get MDL version history."""
    versions = (
        db.query(MDLVersion)
        .order_by(MDLVersion.version.desc())
        .limit(limit)
        .all()
    )
    
    return [
        {
            "version": v.version,
            "created_at": v.created_at,
            "created_by": str(v.created_by) if v.created_by else None,
            "change_summary": v.change_summary
        }
        for v in versions
    ]


@router.get("/datasources")
def get_synced_datasources(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get synced data sources with their table and column information.
    
    Returns only data sources that have been successfully synced,
    with table counts and column summaries for the modeling studio.
    """
    from app.services.duckdb_manager import duckdb_manager
    
    # Get all connections with successful sync status
    connections = (
        db.query(DbConnection)
        .join(SyncConfig, SyncConfig.connection_id == DbConnection.id, isouter=True)
        .filter(SyncConfig.last_sync_status == "success")
        .all()
    )
    
    datasources = []
    for conn in connections:
        sync_config = conn.sync_config
        schema_name = connection_schema_name(conn.id)
        
        # Get tables and columns from DuckDB for this schema
        tables_info = []
        try:
            tables = duckdb_manager.execute(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = ?
                AND table_name NOT LIKE '_dlt_%'
                AND table_name NOT LIKE '%_staging'
                """,
                (schema_name,),
            )
            
            for t in tables:
                table_name = t["table_name"]
                cols = duckdb_manager.execute(
                    """
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = ? 
                    AND table_name = ?
                    ORDER BY ordinal_position
                    """,
                    (schema_name, table_name),
                )
                tables_info.append({
                    "name": table_name,
                    "column_count": len(cols),
                    "columns": [{"name": c["column_name"], "type": c["data_type"]} for c in cols]
                })
        except Exception as e:
            logger.warning(f"Failed to get tables for {schema_name}: {e}")
        
        datasources.append({
            "id": conn.id,
            "name": conn.name,
            "type": conn.connection_type,
            "schema": schema_name,
            "database": conn.database_name,
            "last_sync": sync_config.last_sync_at.isoformat() if sync_config and sync_config.last_sync_at else None,
            "table_count": len(tables_info),
            "tables": tables_info
        })
    
    return {"datasources": datasources, "count": len(datasources)}


@router.get("/relationships/suggestions", response_model=List[RelationshipSuggestion])
def get_relationship_suggestions(
    status_filter: Optional[str] = "pending",
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get AI-suggested relationships.
    
    Filter by status: pending, confirmed, rejected, or all.
    """
    query = db.query(SuggestedRelationship)
    
    if status_filter and status_filter != "all":
        query = query.filter(SuggestedRelationship.status == status_filter)
    
    return query.order_by(SuggestedRelationship.confidence.desc()).all()


@router.post("/relationships/confirm")
def confirm_relationship(
    request: RelationshipConfirmRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Confirm or reject a suggested relationship.
    
    Confirmed relationships are added to the MDL.
    """
    suggestion = db.query(SuggestedRelationship).filter(
        SuggestedRelationship.id == request.relationship_id
    ).first()
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    suggestion.status = "confirmed" if request.action == "confirm" else "rejected"
    suggestion.confirmed_by = current_user.id
    
    db.commit()
    
    # If confirmed, add to MDL
    if request.action == "confirm":
        current_mdl = get_current_mdl(db)
        if current_mdl:
            content = current_mdl.content.copy()
            relationships = content.get("relationships", [])
            
            # Add new relationship
            # Convention: from = PK side (one), to = FK side (many) → one_to_many
            new_rel = {
                "name": f"{suggestion.from_table}_{suggestion.from_column}__{suggestion.to_table}_{suggestion.to_column}",
                "from": suggestion.to_table,
                "from_column": suggestion.to_column,
                "to": suggestion.from_table,
                "to_column": suggestion.from_column,
                "join_type": "one_to_many",
                "condition": f"{suggestion.to_table}.{suggestion.to_column} = {suggestion.from_table}.{suggestion.from_column}",
                "confidence": suggestion.confidence,
                "method": "ai_suggestion",
            }
            relationships.append(new_rel)
            content["relationships"] = relationships
            
            # Create new MDL version
            new_mdl = MDLVersion(
                version=current_mdl.version + 1,
                content=content,
                user_overrides=current_mdl.user_overrides,
                created_by=current_user.id,
                change_summary=f"Added relationship: {suggestion.from_table} -> {suggestion.to_table}"
            )
            db.add(new_mdl)
            db.commit()
    
    return {"message": f"Relationship {request.action}ed", "id": suggestion.id}


@router.post("/relationships/suggest")
async def trigger_relationship_suggestion(
    connection_ids: Optional[List[str]] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Trigger AI-powered relationship suggestion.
    
    Analyzes synced data sources and suggests potential FK relationships.
    Pass connection_ids to limit analysis to specific synced sources.
    """
    from app.services.relationship_suggestor import relationship_suggestor
    
    try:
        # If no connection_ids provided, use all synced connections
        if not connection_ids:
            synced = (
                db.query(SyncConfig.connection_id)
                .filter(SyncConfig.last_sync_status == "success")
                .all()
            )
            connection_ids = [str(s.connection_id) for s in synced] if synced else None
        
        suggestions = await relationship_suggestor.suggest_relationships(
            db, connection_ids=connection_ids
        )
        
        # Store suggestions in DB and return persisted rows (with ids/status)
        persisted_suggestions: List[Dict[str, Any]] = []
        for suggestion in suggestions:
            existing = db.query(SuggestedRelationship).filter(
                SuggestedRelationship.from_table == suggestion["from_table"],
                SuggestedRelationship.from_column == suggestion["from_column"],
                SuggestedRelationship.to_table == suggestion["to_table"],
                SuggestedRelationship.to_column == suggestion["to_column"]
            ).first()

            if existing:
                # Refresh confidence and move back to pending so it appears in UI queue
                existing.confidence = suggestion["confidence"]
                existing.status = "pending"
                existing.confirmed_by = None
                row = existing
            else:
                row = SuggestedRelationship(
                    from_table=suggestion["from_table"],
                    from_column=suggestion["from_column"],
                    to_table=suggestion["to_table"],
                    to_column=suggestion["to_column"],
                    confidence=suggestion["confidence"],
                    status="pending",
                )
                db.add(row)

            db.flush()
            persisted_suggestions.append({
                "id": str(row.id),
                "from_table": row.from_table,
                "from_column": row.from_column,
                "to_table": row.to_table,
                "to_column": row.to_column,
                "confidence": row.confidence,
                "status": row.status,
            })

        db.commit()

        return {
            "message": f"Generated {len(persisted_suggestions)} suggestions",
            "suggestions": persisted_suggestions,
            "connection_ids": connection_ids
        }
    except Exception as e:
        logger.error(f"Relationship suggestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/relationships")
def create_relationship(
    request: ManualRelationshipRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Manually create a relationship between tables.
    
    Adds the relationship directly to the MDL.
    """
    release_expired_locks(db)
    
    # Check lock
    lock = check_lock(db)
    if lock and lock.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="MDL is locked by another user"
        )
    
    current_mdl = get_current_mdl(db)
    if not current_mdl:
        raise HTTPException(status_code=404, detail="No MDL exists. Run sync first.")
    
    content = current_mdl.content.copy()
    relationships = content.get("relationships", [])
    
    # Check for duplicate
    rel_name = f"{request.from_table}_{request.to_table}"
    existing = next((r for r in relationships if r.get("name") == rel_name), None)
    if existing:
        raise HTTPException(status_code=400, detail="Relationship already exists")
    
    # Add new relationship
    new_rel = {
        "name": rel_name,
        "from": request.from_table,
        "from_column": request.from_column,
        "to": request.to_table,
        "to_column": request.to_column,
        "join_type": request.join_type,
        "condition": f"{request.from_table}.{request.from_column} = {request.to_table}.{request.to_column}",
        "method": "manual",
        "confidence": 1.0
    }
    relationships.append(new_rel)
    content["relationships"] = relationships
    
    # Create new MDL version
    new_mdl = MDLVersion(
        version=current_mdl.version + 1,
        content=content,
        user_overrides=current_mdl.user_overrides,
        created_by=current_user.id,
        change_summary=f"Added manual relationship: {request.from_table} -> {request.to_table}"
    )
    db.add(new_mdl)
    db.commit()
    
    return {
        "message": "Relationship created",
        "relationship": new_rel,
        "version": new_mdl.version
    }


@router.delete("/relationships/{rel_name}")
def delete_relationship(
    rel_name: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Delete a relationship from the MDL.
    """
    release_expired_locks(db)
    
    # Check lock
    lock = check_lock(db)
    if lock and lock.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="MDL is locked by another user"
        )
    
    current_mdl = get_current_mdl(db)
    if not current_mdl:
        raise HTTPException(status_code=404, detail="No MDL exists")
    
    content = current_mdl.content.copy()
    relationships = content.get("relationships", [])
    
    # Find and remove relationship
    original_count = len(relationships)
    relationships = [r for r in relationships if r.get("name") != rel_name]
    
    if len(relationships) == original_count:
        raise HTTPException(status_code=404, detail="Relationship not found")
    
    content["relationships"] = relationships
    
    # Create new MDL version
    new_mdl = MDLVersion(
        version=current_mdl.version + 1,
        content=content,
        user_overrides=current_mdl.user_overrides,
        created_by=current_user.id,
        change_summary=f"Deleted relationship: {rel_name}"
    )
    db.add(new_mdl)
    db.commit()
    
    return {
        "message": "Relationship deleted",
        "rel_name": rel_name,
        "version": new_mdl.version
    }


@router.get("/relationships")
def list_relationships(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    List all relationships in the current MDL.
    """
    current_mdl = get_current_mdl(db)
    if not current_mdl:
        return {"relationships": [], "isolated_tables": []}
    
    content = current_mdl.content
    relationships = content.get("relationships", [])
    isolated_tables = content.get("isolated_tables", [])
    isolated_sources = content.get("isolated_sources", [])
    
    return {
        "relationships": relationships,
        "isolated_tables": isolated_tables,
        "isolated_sources": isolated_sources
    }
