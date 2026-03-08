"""
Migration script to create conversation and chat_messages tables.
Run this script to add the new tables to your database.
"""
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

CREATE_TABLES_SQL = """
-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    sql_query TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on conversation_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
"""

async def run_migration():
    print("Running migration to create conversation tables...")
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text(CREATE_TABLES_SQL))
            await db.commit()
            print("✅ Migration completed successfully!")
            print("   - Created 'conversations' table")
            print("   - Created 'chat_messages' table")
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            await db.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(run_migration())
