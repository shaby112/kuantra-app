import sys
import os

# Add the current directory to path
sys.path.append(os.path.abspath("."))

print("Testing imports...")
try:
    from app.core.config import settings
    print(f"Settings loaded. DATABASE_URL starts with: {settings.DATABASE_URL[:20]}...")
    from app.core.logging import logger
    print("Logging initialized")
    from app.core.database import engine
    print(f"Database engine URL: {engine.url}")
    from app.services.schema_service import schema_service
    print("Schema service initialized")
    from app.main import app
    print("FastAPI app instance created")
    print("SUCCESS: All modules imported successfully")
except Exception as e:
    import traceback
    print(f"FAILURE: {e}")
    traceback.print_exc()
