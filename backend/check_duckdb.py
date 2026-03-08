
import duckdb
from app.core.config import settings

def check_duckdb():
    try:
        conn = duckdb.connect(settings.DUCKDB_DATABASE_PATH)
        print(f"Connected to DuckDB at {settings.DUCKDB_DATABASE_PATH}")
        
        # List tables
        tables = conn.execute("SHOW TABLES").fetchall()
        print("Tables found:", tables)
        
        for table in tables:
            table_name = table[0]
            count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
            print(f"Table: {table_name}, Rows: {count}")
            
            # Show schema to check for _dlt columns
            schema = conn.execute(f"DESCRIBE {table_name}").fetchall()
            columns = [col[0] for col in schema]
            print(f"Columns in {table_name}: {columns}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_duckdb()
