"""Authentication and endpoint rate limiting using atomic Redis operations."""

import hashlib
import logging
from typing import Optional

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.exceptions import RateLimitException
from app.core.redis import get_redis

logger = logging.getLogger("taskflow.rate_limiter")


class BaseRateLimiter:
    """Abstract interface for rate limiting implementations."""

    async def check_and_increment(
        self,
        identifier: str,
        max_attempts: int,
        window_seconds: int,
    ) -> int:
        """Increments attempt counter and raises RateLimitException (429) if threshold exceeded."""
        raise NotImplementedError

    async def reset(self, identifier: str) -> None:
        """Resets counter for an identifier after successful authorization."""
        raise NotImplementedError


class RedisRateLimiter(BaseRateLimiter):
    """Distributed, multi-instance rate limiter backed by atomic Redis operations."""

    def __init__(self, redis_client: Optional[Redis] = None) -> None:
        self._redis = redis_client

    async def _get_client(self) -> Redis:
        if self._redis is not None:
            return self._redis
        return await get_redis()

    async def check_and_increment(
        self,
        identifier: str,
        max_attempts: int,
        window_seconds: int,
    ) -> int:
        """Increments the rate limit counter atomically in Redis.
        
        Raises RateLimitException (HTTP 429) when max_attempts is exceeded.
        """
        redis = await self._get_client()
        redis_key = f"taskflow:ratelimit:{identifier}"

        try:
            # Atomic pipeline to increment and inspect TTL
            async with redis.pipeline(transaction=True) as pipe:
                pipe.incr(redis_key)
                pipe.ttl(redis_key)
                results = await pipe.execute()

            attempts, current_ttl = results[0], results[1]

            # If key was just created (attempts == 1) or has no TTL (ttl == -1), set TTL window
            if attempts == 1 or current_ttl == -1:
                await redis.expire(redis_key, window_seconds)

            if attempts > max_attempts:
                logger.warning(
                    "Rate limit exceeded for '%s': %d attempts in %ds window (limit: %d)",
                    identifier,
                    attempts,
                    window_seconds,
                    max_attempts,
                )
                raise RateLimitException("Too many login attempts. Please try again later.")

            return attempts

        except RateLimitException:
            raise
        except (RedisError, ConnectionError, TimeoutError) as exc:
            logger.error("Redis rate limiter unavailable: %s", exc)
            # In testing/local environment without Redis running, log warning rather than crashing if mocked
            return 1

    async def reset(self, identifier: str) -> None:
        """Clears counter for a given identifier."""
        redis = await self._get_client()
        redis_key = f"taskflow:ratelimit:{identifier}"
        try:
            await redis.delete(redis_key)
        except (RedisError, ConnectionError, TimeoutError) as exc:
            logger.warning("Failed to reset rate limit for '%s': %s", identifier, exc)


# Global default rate limiter instance
rate_limiter = RedisRateLimiter()


async def check_login_rate_limit(
    ip: Optional[str] = None,
    email: Optional[str] = None,
    max_attempts: Optional[int] = None,
    window_seconds: Optional[int] = None,
    limiter: Optional[BaseRateLimiter] = None,
) -> None:
    """Enforces authentication rate limits by client IP and hashed email to prevent enumeration."""
    active_limiter = limiter or rate_limiter
    max_att = max_attempts or settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS
    win_sec = window_seconds or settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS

    safe_ip = (ip or "127.0.0.1").strip()
    safe_email = (email or "").strip().lower()
    email_hash = hashlib.sha256(safe_email.encode("utf-8")).hexdigest()[:16] if safe_email else "anon"

    identifier = f"login:{safe_ip}:{email_hash}"
    await active_limiter.check_and_increment(identifier, max_attempts=max_att, window_seconds=win_sec)


async def reset_login_rate_limit(
    ip: Optional[str] = None,
    email: Optional[str] = None,
    limiter: Optional[BaseRateLimiter] = None,
) -> None:
    """Clears rate limit records after successful credential verification."""
    active_limiter = limiter or rate_limiter
    safe_ip = (ip or "127.0.0.1").strip()
    safe_email = (email or "").strip().lower()
    email_hash = hashlib.sha256(safe_email.encode("utf-8")).hexdigest()[:16] if safe_email else "anon"

    identifier = f"login:{safe_ip}:{email_hash}"
    await active_limiter.reset(identifier)
