import os
import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Kuantra"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development" # development, production, test
    IS_VERCEL: bool = False
    
    # Gemini AI
    GOOGLE_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.0-flash"
    
    # Database (Async)
    DATABASE_URL: str = ""
    # Database (Sync compatibility)
    SQLALCHEMY_DATABASE_URI: str = ""
    
    # Legacy DB variables
    POSTGRES_SERVER: str = ""
    POSTGRES_USER: str = ""
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = ""
    
    # Auth modes: dev (no token), license (HS256 token), jwks (OIDC/JWKS)
    AUTH_MODE: str = "dev"
    AUTH_SECRET_KEY: str = ""  # HMAC secret for license mode JWT signing/verification
    AUTH_ISSUER: str = ""
    AUTH_JWKS_URL: str = ""

    # Auth (Logto - Self-Hosted SSO)
    LOGTO_ISSUER: str = ""
    LOGTO_JWKS_URL: str = ""
    LOGTO_AUDIENCE: str = ""

    ENCRYPTION_KEY: str = ""
    
    # SMTP Settings
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CORS_ORIGINS: str = ""
    CORS_ALLOW_ORIGIN_REGEX: str = r"^https://.*\.vercel\.app$"
    
    # App
    DEBUG: bool = True
    PORT: int = 8000
    
    # DuckDB Enterprise Settings
    DUCKDB_DATABASE_PATH: str = "data/warehouse.duckdb"
    DUCKDB_MEMORY_LIMIT: str = "4GB"  # Fixed limit to avoid parser errors with %
    DUCKDB_TEMP_DIR: str = "data/duckdb_temp"
    UPLOAD_DIR: str = "uploads"
    DUCKDB_THREADS: int = 4
    DUCKDB_PRESERVE_ORDER: bool = False  # Memory optimization
    BRONZE_BASE_PATH: str = "data/bronze"
    
    # ETL Settings
    ETL_MAX_CONCURRENT_SYNCS: int = 3
    ETL_DEFAULT_BATCH_SIZE: int = 10000
    ETL_RETRY_ATTEMPTS: int = 3
    ETL_RETRY_DELAY_SECONDS: int = 30
    
    # Sync Settings
    DEFAULT_SYNC_INTERVAL_MINUTES: int = 60
    MIN_SYNC_INTERVAL_MINUTES: int = 5
    
    # ETL Batching Settings (for large table handling)
    ETL_TABLES_PER_BATCH: int = 5  # Process 5 tables at a time
    ETL_LARGE_TABLE_THRESHOLD: int = 100000  # Tables with >100K rows get special handling
    ETL_FETCH_SIZE_LARGE: int = 200  # For tables >100K rows
    ETL_FETCH_SIZE_MEDIUM: int = 500  # For tables 10K-100K rows
    ETL_FETCH_SIZE_SMALL: int = 1000  # For tables <10K rows
    ETL_CHUNK_TIMEOUT_SECONDS: int = 30  # Timeout per fetch operation

    # Query safety/timeouts
    EXTERNAL_QUERY_TIMEOUT_SECONDS: int = 30
    ANALYTICAL_QUERY_TIMEOUT_SECONDS: int = 120

    # LLM provider selection
    AI_PROVIDER: str = "gemini"  # gemini | local
    ALLOW_CLOUD_LLM: bool = True
    LOCAL_LLM_BASE_URL: str = ""
    LOCAL_LLM_MODEL: str = "qwen3.5:4b"
    LOCAL_LLM_API_KEY: str = ""
    LOCAL_LLM_AUTO_PULL: bool = False
    LOCAL_LLM_HEALTH_TIMEOUT_SECONDS: int = 10

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "120/minute"
    RATE_LIMIT_CHAT_STREAM: str = "30/minute"
    RATE_LIMIT_QUERY_EXECUTE: str = "60/minute"
    RATE_LIMIT_AUTH_WRITE: str = "20/minute"
    
    @model_validator(mode='after')
    def assemble_db_urls(self):
        # Detect Vercel
        self.IS_VERCEL = os.environ.get("VERCEL") == "1"
        if self.IS_VERCEL:
            self.ENVIRONMENT = "production"
            # In Vercel, we MUST use /tmp for any write operations
            self.DUCKDB_DATABASE_PATH = "/tmp/warehouse.duckdb"
            self.DUCKDB_TEMP_DIR = "/tmp/duckdb_temp"
            self.UPLOAD_DIR = "/tmp/uploads"
            self.BRONZE_BASE_PATH = "/tmp/bronze"
            
        # Ensure directories exist (only for non-vercel or if possible)
        if not self.IS_VERCEL:
            for d in [os.path.dirname(self.DUCKDB_DATABASE_PATH), self.DUCKDB_TEMP_DIR, self.UPLOAD_DIR, self.BRONZE_BASE_PATH]:
                if d and not os.path.exists(d):
                    os.makedirs(d, exist_ok=True)
        else:
             # In Vercel, we can try to create them in /tmp
             for d in [os.path.dirname(self.DUCKDB_DATABASE_PATH), self.DUCKDB_TEMP_DIR, self.UPLOAD_DIR, self.BRONZE_BASE_PATH]:
                if d and not os.path.exists(d):
                    try:
                        os.makedirs(d, exist_ok=True)
                    except OSError:
                        pass

        # Handle construction from separate Postgres parts if URI is missing
        if not self.SQLALCHEMY_DATABASE_URI and self.POSTGRES_SERVER:
            self.SQLALCHEMY_DATABASE_URI = f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"
            
        if not self.DATABASE_URL and self.SQLALCHEMY_DATABASE_URI:
            # If only sync URI provided, try to make it async if postgres
            if "postgresql://" in self.SQLALCHEMY_DATABASE_URI:
                self.DATABASE_URL = self.SQLALCHEMY_DATABASE_URI.replace("postgresql://", "postgresql+asyncpg://")
            else:
                self.DATABASE_URL = self.SQLALCHEMY_DATABASE_URI
        
        if not self.SQLALCHEMY_DATABASE_URI and self.DATABASE_URL:
            # If only async URL provided, make sync one
            self.SQLALCHEMY_DATABASE_URI = self.DATABASE_URL.replace("+asyncpg", "")

        auth_mode = (self.AUTH_MODE or "dev").lower()
        if auth_mode not in {"dev", "license", "jwks"}:
            raise ValueError("AUTH_MODE must be one of: dev, license, jwks.")

        provider = (self.AI_PROVIDER or "gemini").lower()

        if provider not in {"gemini", "local", "ollama"}:
            raise ValueError("AI_PROVIDER must be 'gemini', 'ollama', or 'local'.")

        if not self.ALLOW_CLOUD_LLM and provider == "gemini":
            raise ValueError(
                "Invalid config: ALLOW_CLOUD_LLM is false but AI_PROVIDER is 'gemini'. "
                "Set AI_PROVIDER='local' for no-egress mode."
            )

        if provider == "local" and not self.LOCAL_LLM_BASE_URL:
            raise ValueError("LOCAL_LLM_BASE_URL must be set when AI_PROVIDER='local'.")

        if self.AUTH_ISSUER and not self.AUTH_JWKS_URL:
            self.AUTH_JWKS_URL = f"{self.AUTH_ISSUER.rstrip('/')}/.well-known/jwks.json"
        
        if self.LOGTO_ISSUER and not self.LOGTO_JWKS_URL:
            self.LOGTO_JWKS_URL = f"{self.LOGTO_ISSUER.rstrip('/')}/oidc/jwks"


        # Auto-generate encryption key if not provided.
        # In production, set ENCRYPTION_KEY for stable secrets across restarts.
        if not self.ENCRYPTION_KEY:
            self.ENCRYPTION_KEY = secrets.token_urlsafe(32)

        auth_mode = (self.AUTH_MODE or "dev").lower()
        if auth_mode not in {"jwks", "license", "dev"}:
            raise ValueError("AUTH_MODE must be 'jwks', 'license', or 'dev'.")
        self.AUTH_MODE = auth_mode

        is_production = (self.ENVIRONMENT or "").lower() == "production"
        if is_production and auth_mode == "dev":
            raise ValueError("AUTH_MODE='dev' is not allowed in production.")
        if is_production and auth_mode == "jwks" and not (self.AUTH_ISSUER or self.AUTH_JWKS_URL or self.LOGTO_ISSUER or self.LOGTO_JWKS_URL):
            raise ValueError("AUTH_JWKS_URL (or LOGTO_JWKS_URL) must be set in production with AUTH_MODE='jwks'.")
        if auth_mode == "license" and not self.AUTH_SECRET_KEY:
            raise ValueError("AUTH_SECRET_KEY must be set when AUTH_MODE='license'.")
            
        return self

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        extra="ignore"
)
settings = Settings()
