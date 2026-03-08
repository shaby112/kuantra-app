
import sys
import os

# Set DuckDB to memory to avoid lock conflict with running backend
os.environ["DUCKDB_DATABASE_PATH"] = ":memory:"

# Add project root to path
sys.path.append(os.getcwd())

from app.services.mdl_generator import mdl_generator, RAPIDFUZZ_AVAILABLE
from app.services.schema_service import schema_service

print("✅ Imports successful")
print(f"RapidFuzz Available: {RAPIDFUZZ_AVAILABLE}")

print("MDL Generator and Schema Service valid.")
