
from sqlalchemy import text
from app.db.session import engine
from app.core.config import settings

def migrate():
    print(f"Connecting to {settings.POSTGRES_SERVER}...")
    try:
        with engine.connect() as conn:
            # Check if column exists
            check_query = text("SELECT column_name FROM information_schema.columns WHERE table_name='db_connections' AND column_name='connection_uri';")
            result = conn.execute(check_query).fetchone()
            
            if not result:
                print("Adding connection_uri column...")
                conn.execute(text("ALTER TABLE db_connections ADD COLUMN connection_uri VARCHAR;"))
                conn.execute(text("ALTER TABLE db_connections ALTER COLUMN database_name DROP NOT NULL;"))
                conn.execute(text("ALTER TABLE db_connections ALTER COLUMN username DROP NOT NULL;"))
                conn.execute(text("ALTER TABLE db_connections ALTER COLUMN encrypted_password DROP NOT NULL;"))
                conn.commit()
                print("Column added and constraints updated.")
            else:
                print("Column already exists.")
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
