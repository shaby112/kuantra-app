print("Importing settings...")
from app.core.config import settings
print("Importing session...")
from app.db.session import engine
print("Importing deps...")
from app.api import deps
print("Importing chat endpoints...")
from app.api.v1.endpoints import chat
print("Importing auth endpoints...")
from app.api.v1.endpoints import auth
print("Importing connections endpoints...")
from app.api.v1.endpoints import connections
print("Importing api router...")
from app.api.v1.api import api_router
print("Done")
