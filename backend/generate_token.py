
from app.utils.jwt import create_access_token
from datetime import timedelta

token = create_access_token({"sub": "2"}, expires_delta=timedelta(days=1))
print(f"TOKEN_START_{token}_TOKEN_END")
