"""
Migration script to create dashboards table.
Run this script to add the new tables to your database.
"""
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal
import sys
import os

# Ensure app module is importable
sys.path.append(os.getcwd())

async def run_migration():
    print("Running migration to create dashboards table...")
    async with AsyncSessionLocal() as db:
        try:
            # 1. Create Table
            print("Creating dashboards table...")
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS dashboards (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    config JSONB NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
            """))
            
            # 2. Create Index
            print("Creating index...")
            await db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);
            """))

            await db.commit()
            print("✅ Migration completed successfully!")
            print("   - Created 'dashboards' table")
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            await db.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(run_migration())
