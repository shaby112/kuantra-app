"""
ETL Scheduler using APScheduler.

Handles periodic background application of data synchronization jobs.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import asyncio

from app.core.config import settings
from app.core.logging import logger
from app.db.session import SessionLocal
from app.db.models import SyncConfig, DbConnection
from app.etl.sync_service import sync_service


class ETLScheduler:
    """
    Scheduler for ETL jobs.
    
    Checks SyncConfig for connections that need syncing based on:
    - is_auto_sync_enabled = True
    - last_sync_at + sync_interval_minutes < now
    """
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._is_running = False
        
    def start(self):
        """Start the scheduler."""
        if self._is_running:
            return

        # Vercel/serverless instances are short-lived and can freeze background jobs.
        # Running APScheduler here creates noisy misfire logs and unreliable behavior.
        if settings.IS_VERCEL:
            logger.info("Skipping ETL Scheduler startup on Vercel runtime.")
            return
            
        logger.info("Starting ETL Scheduler...")
        
        # Add job to check for due syncs every minute
        self.scheduler.add_job(
            self._check_and_trigger_syncs,
            IntervalTrigger(minutes=1),
            id="etl_check_syncs",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=60,
        )
        
        self.scheduler.start()
        self._is_running = True
        logger.info("ETL Scheduler started")
    
    def shutdown(self):
        """Shutdown the scheduler."""
        if not self._is_running:
            return
            
        logger.info("Shutting down ETL Scheduler...")
        self.scheduler.shutdown()
        self._is_running = False
    
    async def _check_and_trigger_syncs(self):
        """Check for connections that need syncing."""
        logger.debug("Checking for due syncs...")
        
        try:
            # We need a new session for this background task
            db = SessionLocal()
            try:
                # Find configs that are enabled and not currently syncing
                # Note: This simple check doesn't account for distributed locks, 
                # but valid for single-instance deployment
                
                # Get all enabled configs
                configs = db.query(SyncConfig).join(DbConnection).filter(
                    SyncConfig.is_auto_sync_enabled == True
                ).all()
                
                from datetime import timezone
                for config in configs:
                    # Check if due
                    if not config.last_sync_at:
                        is_due = True
                    else:
                        next_sync = config.last_sync_at + timedelta(minutes=config.sync_interval_minutes or 30)
                        is_due = datetime.now(timezone.utc) >= next_sync
                    
                    if is_due:
                        # Check if already running via service
                        if sync_service.is_syncing(config.connection_id):
                            continue
                            
                        logger.info(f"Triggering scheduled sync for connection {config.connection_id}")
                        
                        # Trigger sync
                        # We use the service directly
                        connection = db.query(DbConnection).filter(
                            DbConnection.id == config.connection_id
                        ).first()
                        
                        if connection:
                            await sync_service.start_sync(db, connection, incremental=True)
                            
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error in scheduler job: {e}")

# Global instance
etl_scheduler = ETLScheduler()
