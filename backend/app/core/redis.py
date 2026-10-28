"""Asynchronous Redis client provider and connection pool management."""

import logging
from typing import Optional
import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger("taskflow.redis")

_redis_client: Optional[Redis] = None


async def init_redis_client() -> Optional[Redis]:
    """Initializes and returns the global async Redis client."""
    global _redis_client
    if _redis_client is None:
        timeout_sec = max(0.1, settings.REDIS_TIMEOUT_MS / 1000.0)
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=timeout_sec,
            socket_timeout=timeout_sec,
        )
    return _redis_client


async def close_redis_client() -> None:
    """Closes active Redis connection pools on application shutdown."""
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
        except Exception as exc:
            logger.warning("Error closing Redis client: %s", exc)
        finally:
            _redis_client = None


def set_redis_client(client: Optional[Redis]) -> None:
    """Injects a custom Redis instance (useful for unit test mocks or test environments)."""
    global _redis_client
    _redis_client = client


async def get_redis() -> Redis:
    """FastAPI dependency for accessing the active Redis client."""
    global _redis_client
    if _redis_client is None:
        await init_redis_client()
    return _redis_client
