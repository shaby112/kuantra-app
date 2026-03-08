
import asyncio
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.api import deps
from app.db.models import DbConnection, User
from app.etl.sync_service import sync_service
from app.core.config import settings

# Setup DB session
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

async def trigger_sync():
    db = SessionLocal()
    try:
        connection_id = 3
        connection = db.query(DbConnection).filter(DbConnection.id == connection_id).first()
        if not connection:
            print(f"Connection {connection_id} not found")
            return

        print(f"Triggering sync for connection {connection.name} (ID: {connection.id})")
        # Run sync (incremental=False to force full refresh if needed, but my fix is in self-healing)
        # Let's try incremental=True first to trigger the failure and the self-healing
        job = await sync_service.start_sync(db, connection, incremental=True)
        print(f"Sync started: Job ID {job.job_id}")
        
        # Wait for completion? sync_service.start_sync is async but it might spawn background task
        # Check source of start_sync.
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(trigger_sync())
