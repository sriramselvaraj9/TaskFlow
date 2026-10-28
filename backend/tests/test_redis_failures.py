"""Tests for fail-secure behavior when Redis is unavailable or fails."""

from unittest.mock import AsyncMock
from httpx import AsyncClient
import pytest
from redis.exceptions import ConnectionError, RedisError

from app.core.exceptions import AuthenticationException
from app.core.redis_session import RedisSessionService
from app.core.security import create_refresh_token


@pytest.mark.asyncio
async def test_redis_failure_fails_securely_on_rotation():
    """Verify refresh rotation fails securely (raises 401) and NEVER bypasses checks when Redis is down."""
    # Mock Redis client that simulates a connection failure
    broken_redis = AsyncMock()
    broken_redis.set.side_effect = ConnectionError("Redis server unreachable")
    broken_redis.get.side_effect = ConnectionError("Redis server unreachable")

    service = RedisSessionService(broken_redis)
    refresh_tok, _ = create_refresh_token(user_id="usr_test_fail", session_id="ses_test_fail")

    # Rotating refresh token when Redis is down MUST fail securely and raise AuthenticationException
    with pytest.raises(AuthenticationException) as excinfo:
        await service.rotate_refresh_token(refresh_tok)

    assert "service unavailable" in str(excinfo.value).lower() or "failed" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_redis_failure_fails_securely_on_session_creation():
    """Verify session creation fails securely when Redis cannot establish the session."""
    broken_redis = AsyncMock()
    broken_redis.set.side_effect = RedisError("Cluster node down")

    service = RedisSessionService(broken_redis)

    with pytest.raises(AuthenticationException) as excinfo:
        await service.create_session(user_id="usr_test_fail")

    assert "service unavailable" in str(excinfo.value).lower()
