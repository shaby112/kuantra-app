"""
Sync API Endpoints.

Provides endpoints for:
- Manual sync triggers
- Sync All functionality
- Sync status and progress
- Sync configuration (intervals, auto-sync)
- Sync history/audit trail
"""

from typing import List, Optional
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.db.models import User, DbConnection, SyncConfig, SyncHistory
from app.etl.sync_service import sync_service
from app.core.logging import logger
from app.services.duckdb_manager import duckdb_manager
from app.utils.identifiers import connection_schema_name

router = APIRouter()


# --- Pydantic Schemas ---

class SyncTriggerResponse(BaseModel):
    """Response when sync is triggered."""
    job_id: str
    connection_id: str
    status: str
    message: str


class SyncStatusResponse(BaseModel):
    """Response for sync status queries."""
    connection_id: str
    status: str  # never, success, failed, running
    last_sync_at: Optional[datetime] = None
    rows_cached: int = 0
    tables_cached: List[str] = []
    is_syncing: bool = False
    progress: int = 0
    error: Optional[str] = None


class SyncProgressResponse(BaseModel):
    """Response for sync progress queries."""
    job_id: str
    status: str
    progress: int
    rows_synced: int
    tables_completed: List[str]
    tables_pending: List[str]
    error: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None


class SyncConfigUpdate(BaseModel):
    """Request to update sync configuration."""
    sync_interval_minutes: Optional[int] = None
    is_auto_sync_enabled: Optional[bool] = None


class SyncConfigResponse(BaseModel):
    """Response for sync configuration."""
    connection_id: str
    sync_interval_minutes: int
    is_auto_sync_enabled: bool
    
    class Config:
        from_attributes = True


class SyncHistoryItem(BaseModel):
    """Single sync history entry."""
    id: str
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    rows_synced: int
    is_incremental: bool
    error_message: Optional[str]
    duration_seconds: Optional[float]
    
    class Config:
        from_attributes = True


def _get_materialized_tables(connection_id: UUID) -> List[str]:
    """
    Return cached DuckDB table names for a synced connection schema.
    Uses current deployment storage (important for serverless environments).
    """
    schema_name = connection_schema_name(connection_id)
    try:
        rows = duckdb_manager.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
              AND table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY table_name
            """,
            (schema_name,),
        )
        return [r["table_name"] for r in rows if not str(r["table_name"]).startswith("_dlt")]
    except Exception as e:
        logger.warning(f"Failed to read materialized tables for {schema_name}: {e}")
        return []


def _build_effective_status(
    connection_id: UUID,
    sync_config: Optional[SyncConfig],
    is_syncing: bool,
    progress: int,
) -> SyncStatusResponse:
    materialized_tables = _get_materialized_tables(connection_id)
    has_materialized_cache = len(materialized_tables) > 0

    if sync_config:
        status = sync_config.last_sync_status
        last_sync_at = sync_config.last_sync_at
        rows_cached = sync_config.rows_cached
        tables_cached = sync_config.tables_cached or []
        error = sync_config.last_error if status != "success" else None
    else:
        status = "never"
        last_sync_at = None
        rows_cached = 0
        tables_cached = []
        error = None

    # If metadata says "success" but this deployment has no cached tables,
    # treat as unsynced to avoid false-positive "Synced" UI.
    if not is_syncing and status == "success" and not has_materialized_cache:
        status = "never"
        last_sync_at = None
        rows_cached = 0
        tables_cached = []
        error = (
            "No cached data in this deployment yet. "
            "Run sync here before exploring tables."
        )

    # Prefer actual materialized tables as source of truth for UI display.
    if has_materialized_cache:
        tables_cached = materialized_tables

    if is_syncing:
        status = "running"

    return SyncStatusResponse(
        connection_id=str(connection_id),
        status=status,
        last_sync_at=last_sync_at,
        rows_cached=rows_cached,
        tables_cached=tables_cached,
        is_syncing=is_syncing,
        progress=progress,
        error=error,
    )


# --- Endpoints ---

@router.post("/{connection_id}", response_model=SyncTriggerResponse)
async def trigger_sync(
    connection_id: UUID,
    incremental: bool = True,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Trigger a manual sync for a connection.
    
    - **connection_id**: ID of the connection to sync
    - **incremental**: If true, only sync changed data (default: true)
    """
    # Get connection
    connection = db.query(DbConnection).filter(
        DbConnection.id == connection_id,
        DbConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Check if already syncing
    if sync_service.is_syncing(str(connection_id)):
        job = sync_service.get_connection_job(str(connection_id))
        return SyncTriggerResponse(
            job_id=job.job_id if job else "",
            connection_id=str(connection_id),
            status="already_running",
            message="Sync is already in progress"
        )
    
    # Start sync
    try:
        job = await sync_service.start_sync(db, connection, incremental)
        
        return SyncTriggerResponse(
            job_id=job.job_id,
            connection_id=str(connection_id),
            status="started",
            message="Sync job started successfully"
        )
    except Exception as e:
        logger.error(f"Failed to start sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/all", response_model=List[SyncTriggerResponse])
async def sync_all_connections(
    incremental: bool = True,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Sync all connections for the current user.
    
    - **incremental**: If true, only sync changed data (default: true)
    """
    connections = db.query(DbConnection).filter(
        DbConnection.user_id == current_user.id
    ).all()
    
    if not connections:
        return []
    
    results = []
    for connection in connections:
        try:
            if sync_service.is_syncing(connection.id):
                job = sync_service.get_connection_job(connection.id)
                results.append(SyncTriggerResponse(
                    job_id=job.job_id if job else "",
                    connection_id=str(connection.id),
                    status="already_running",
                    message="Sync already in progress"
                ))
            else:
                job = await sync_service.start_sync(db, connection, incremental)
                results.append(SyncTriggerResponse(
                    job_id=job.job_id,
                    connection_id=str(connection.id),
                    status="started",
                    message="Sync started"
                ))
        except Exception as e:
            results.append(SyncTriggerResponse(
                job_id="",
                connection_id=str(connection.id),
                status="failed",
                message=str(e)
            ))
    
    return results


@router.get("/{connection_id}/status", response_model=SyncStatusResponse)
async def get_sync_status(
    connection_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get the sync status for a connection."""
    # Verify connection ownership
    connection = db.query(DbConnection).filter(
        DbConnection.id == connection_id,
        DbConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Get sync config
    sync_config = db.query(SyncConfig).filter(
        SyncConfig.connection_id == connection_id
    ).first()
    
    # Check if currently syncing
    job = sync_service.get_connection_job(str(connection_id))
    return _build_effective_status(
        connection_id=connection_id,
        sync_config=sync_config,
        is_syncing=job is not None and job.status == "running",
        progress=job.progress if job else 0,
    )


@router.get("/statuses", response_model=List[SyncStatusResponse])
async def get_all_sync_statuses(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get sync status for all user connections."""
    connections = db.query(DbConnection).filter(
        DbConnection.user_id == current_user.id
    ).all()
    
    if not connections:
        return []
        
    connection_ids = [c.id for c in connections]
    
    sync_configs = db.query(SyncConfig).filter(
        SyncConfig.connection_id.in_(connection_ids)
    ).all()
    
    config_map = {sc.connection_id: sc for sc in sync_configs}
    results = []
    
    for conn in connections:
        sync_config = config_map.get(conn.id)
        job = sync_service.get_connection_job(conn.id)
        results.append(
            _build_effective_status(
                connection_id=conn.id,
                sync_config=sync_config,
                is_syncing=job is not None and job.status == "running",
                progress=job.progress if job else 0,
            )
        )
            
    return results

@router.get("/{connection_id}/progress", response_model=SyncProgressResponse)
async def get_sync_progress(
    connection_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get detailed progress for a running sync."""
    # Verify connection ownership
    connection = db.query(DbConnection).filter(
        DbConnection.id == connection_id,
        DbConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    job = sync_service.get_connection_job(str(connection_id))
    
    if job:
        logger.info(f"get_sync_progress: Found active job {job.job_id} status={job.status}")
    else:
        # Check DB for running job (handle server restart case)
        running_history = db.query(SyncHistory).filter(
            SyncHistory.connection_id == connection_id,
            SyncHistory.status == "running"
        ).order_by(SyncHistory.started_at.desc()).first()
        
        if running_history:
             logger.info(f"get_sync_progress: Found running job in DB {running_history.id}")
             # Construct partial response from DB state
             now = datetime.now(timezone.utc)
             start_time = running_history.started_at
             if start_time.tzinfo is None:
                 start_time = start_time.replace(tzinfo=timezone.utc)
                 
             # Estimate progress based on duration if we can't get real progress
             # This is better than returning 404
             duration = (now - start_time).total_seconds()
             estimated_progress = min(95, int(duration / 2)) # Fake progress up to 95%
             
             return SyncProgressResponse(
                job_id=str(running_history.id),
                status="running",
                progress=estimated_progress,
                rows_synced=running_history.rows_synced,
                tables_completed=running_history.tables_synced or [],
                tables_pending=[], 
                error=None,
                started_at=running_history.started_at,
                completed_at=None
            )
            
        logger.info(f"get_sync_progress: No active job for connection {connection_id}, checking history for recent completion")
    
    if not job:
        # Fallback: Check if there's a recently completed sync in history
        # This handles the race condition where the frontend polls just after sync finishes
        recent_history = db.query(SyncHistory).filter(
            SyncHistory.connection_id == connection_id
        ).order_by(SyncHistory.started_at.desc()).first()
        
        if recent_history and recent_history.status in ["success", "failed"]:
            # If completed within the last minute, return it as the "current" progress
            # Otherwise, it's truly not running
            now = datetime.now(timezone.utc)
            cmp_time = recent_history.completed_at
            
            # Ensure cmp_time is aware if it isn't (SQLite/some DBs might strip it)
            if cmp_time and cmp_time.tzinfo is None:
                cmp_time = cmp_time.replace(tzinfo=timezone.utc)
                
            time_since_completion = (now - (cmp_time or now)).total_seconds()
            if time_since_completion < 60:
                print(f"RECENT HISTORY DEBUG: status={recent_history.status} rows={recent_history.rows_synced}")
                return SyncProgressResponse(
                    job_id=str(recent_history.id), # Use DB ID as job ID proxy
                    status=recent_history.status,
                    progress=100 if recent_history.status == "success" else 0, # Don't fake 100% on failure
                    rows_synced=recent_history.rows_synced,
                    tables_completed=[], # We don't persist this detail in history for now
                    tables_pending=[],
                    error=recent_history.error_message,
                    started_at=recent_history.started_at,
                    completed_at=recent_history.completed_at
                )
        
        raise HTTPException(status_code=404, detail="No active sync job found")
    
    return SyncProgressResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        rows_synced=job.rows_synced,
        tables_completed=job.tables_completed,
        tables_pending=job.tables_pending,
        error=job.error,
        started_at=job.started_at,
        completed_at=job.completed_at
    )


@router.put("/{connection_id}/config", response_model=SyncConfigResponse)
async def update_sync_config(
    connection_id: UUID,
    config: SyncConfigUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update sync configuration for a connection."""
    # Verify connection ownership
    connection = db.query(DbConnection).filter(
        DbConnection.id == connection_id,
        DbConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Get or create sync config
    sync_config = db.query(SyncConfig).filter(
        SyncConfig.connection_id == connection_id
    ).first()
    
    if not sync_config:
        sync_config = SyncConfig(connection_id=connection_id)
        db.add(sync_config)
    
    # Update fields
    if config.sync_interval_minutes is not None:
        sync_config.sync_interval_minutes = max(5, config.sync_interval_minutes)  # Min 5 minutes
    
    if config.is_auto_sync_enabled is not None:
        sync_config.is_auto_sync_enabled = config.is_auto_sync_enabled
    
    db.commit()
    db.refresh(sync_config)
    
    return SyncConfigResponse(
        connection_id=str(connection_id),
        sync_interval_minutes=sync_config.sync_interval_minutes,
        is_auto_sync_enabled=sync_config.is_auto_sync_enabled
    )


@router.get("/{connection_id}/history", response_model=List[SyncHistoryItem])
async def get_sync_history(
    connection_id: UUID,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get sync history for a connection (audit trail)."""
    # Verify connection ownership
    connection = db.query(DbConnection).filter(
        DbConnection.id == connection_id,
        DbConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    history = db.query(SyncHistory).filter(
        SyncHistory.connection_id == connection_id
    ).order_by(SyncHistory.started_at.desc()).limit(limit).all()
    
    return [SyncHistoryItem.from_orm(h) for h in history]


@router.post("/{connection_id}/cancel")
async def cancel_sync(
    connection_id: UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Cancel a running sync."""
    # Verify connection ownership
    connection = db.query(DbConnection).filter(
        DbConnection.id == connection_id,
        DbConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    if sync_service.cancel_sync(str(connection_id)):
        # Update sync config
        sync_config = db.query(SyncConfig).filter(
            SyncConfig.connection_id == connection_id
        ).first()
        
        if sync_config:
            sync_config.last_sync_status = "cancelled"
            db.commit()
        
        return {"status": "cancelled", "message": "Sync cancelled successfully"}
    else:
        raise HTTPException(
            status_code=400,
            detail="No running sync to cancel"
        )
