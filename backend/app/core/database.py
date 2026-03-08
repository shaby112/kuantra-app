from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import settings
from typing import Optional

# Lazy initialization to prevent startup hangs on network issues
_engine = None
_async_session_local = None


def get_engine():
    """Get or create the database engine lazily."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            pool_timeout=10,  # 10 second timeout
            connect_args={
                "prepared_statement_cache_size": 0,
                "statement_cache_size": 0,
                "timeout": 10,  # Connection timeout
            }
        )
    return _engine


def get_async_session_local():
    """Get or create the async session maker lazily."""
    global _async_session_local
    if _async_session_local is None:
        _async_session_local = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _async_session_local


# For backwards compatibility - these will be created on first access
class LazyEngine:
    def __getattr__(self, name):
        return getattr(get_engine(), name)


class LazySessionLocal:
    def __call__(self):
        return get_async_session_local()()
    
    def __getattr__(self, name):
        return getattr(get_async_session_local(), name)


engine = LazyEngine()
AsyncSessionLocal = LazySessionLocal()


class Base(DeclarativeBase):
    pass


async def get_db():
    session_maker = get_async_session_local()
    async with session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
