from cryptography.fernet import Fernet
from app.core.config import settings
import base64
import hashlib


class CryptoService:
    def __init__(self):
        # Ensure we have a valid key for Fernet (32 url-safe base64-encoded bytes)
        # Derive from ENCRYPTION_KEY to keep encryption independent from auth tokens.
        key = hashlib.sha256(settings.ENCRYPTION_KEY.encode()).digest()
        self.key = base64.urlsafe_b64encode(key)
        self.cipher_suite = Fernet(self.key)

    def encrypt(self, data: str) -> str:
        if not data:
            return None
        return self.cipher_suite.encrypt(data.encode()).decode()

    def decrypt(self, token: str) -> str:
        if not token:
            return None
        return self.cipher_suite.decrypt(token.encode()).decode()


crypto_service = CryptoService()
