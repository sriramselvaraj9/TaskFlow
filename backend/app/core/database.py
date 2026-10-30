"""Async SQLAlchemy 2.0 Engine and Session Management."""

from collections.abc import AsyncGenerator
from typing import Any, Dict
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy ORM models."""
    pass


def get_engine_options(database_url: str) -> Dict[str, Any]:
    """Generates engine configuration dictionary tailored to the dialect."""
    options: Dict[str, Any] = {
        "echo": settings.DB_ECHO,
        "future": True,
    }

    if "sqlite" in database_url:
        # SQLite does not support standard QueuePool pool_size/max_overflow parameters
        options["poolclass"] = NullPool
    else:
        # PostgreSQL / asyncpg connection pool tuning
        options["pool_pre_ping"] = settings.DB_POOL_PRE_PING
        options["pool_size"] = settings.DB_POOL_SIZE
        options["max_overflow"] = settings.DB_MAX_OVERFLOW
        options["pool_timeout"] = settings.DB_POOL_TIMEOUT

    return options


# Global Async Engine
engine: AsyncEngine = create_async_engine(
    str(settings.DATABASE_URL),
    **get_engine_options(str(settings.DATABASE_URL)),
)

# Global Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=settings.DB_EXPIRE_ON_COMMIT,
    autoflush=False,
    autocommit=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session with automatic cleanup."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


get_db = get_db_session

