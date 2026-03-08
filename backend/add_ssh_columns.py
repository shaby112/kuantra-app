
import sys
import os
# Add current directory to path so we can import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import get_engine
from app.core.config import settings

def migrate():
    engine = get_engine()
    print(f"Connecting to database...")
    try:
        with engine.connect() as conn:
            # Check if columns exist
            cols_to_add = [
                ("use_ssh_tunnel", "BOOLEAN DEFAULT FALSE NOT NULL"),
                ("ssh_host", "VARCHAR"),
                ("ssh_port", "INTEGER DEFAULT 22"),
                ("ssh_username", "VARCHAR"),
                ("ssh_key_path", "VARCHAR")
            ]
            
            for col_name, col_type in cols_to_add:
                # PostgreSQL information_schema check
                check_query = text(f"SELECT column_name FROM information_schema.columns WHERE table_name='db_connections' AND column_name='{col_name}';")
                result = conn.execute(check_query).fetchone()
                
                if not result:
                    print(f"Adding {col_name} column...")
                    # We use f-string for column names as they are hardcoded and safe
                    conn.execute(text(f"ALTER TABLE db_connections ADD COLUMN {col_name} {col_type};"))
                    print(f"Column {col_name} added.")
                else:
                    print(f"Column {col_name} already exists.")
            
            conn.commit()
            print("Migration completed successfully.")
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
