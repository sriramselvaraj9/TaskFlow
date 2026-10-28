"""Tests for authentication rate limiting: atomic increments, 429 status code, and email non-disclosure."""

from httpx import AsyncClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limiter import RedisRateLimiter, check_login_rate_limit, rate_limiter
from app.core.redis import set_redis_client
from app.core.security import hash_password
from app.daos.user_dao import user_dao
from app.models.user import User, UserRole
from tests.fake_redis import FakeRedis


@pytest.fixture(autouse=True)
def setup_fake_redis():
    """Injects FakeRedis test double into rate limiter."""
    fake_client = FakeRedis()
    set_redis_client(fake_client)
    rate_limiter._redis = fake_client
    yield fake_client
    set_redis_client(None)
    rate_limiter._redis = None


@pytest.mark.asyncio
async def test_rate_limiter_atomic_counter(setup_fake_redis: FakeRedis):
    """Verify atomic counter increments and window expiration."""
    limiter = RedisRateLimiter(setup_fake_redis)

    # 1. First 3 attempts within limit of 3 succeed
    c1 = await limiter.check_and_increment("client_ip_1", max_attempts=3, window_seconds=60)
    assert c1 == 1
    c2 = await limiter.check_and_increment("client_ip_1", max_attempts=3, window_seconds=60)
    assert c2 == 2
    c3 = await limiter.check_and_increment("client_ip_1", max_attempts=3, window_seconds=60)
    assert c3 == 3

    # 2. 4th attempt exceeds limit and raises RateLimitException (429)
    with pytest.raises(Exception) as excinfo:
        await limiter.check_and_increment("client_ip_1", max_attempts=3, window_seconds=60)
    assert "too many" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_login_rate_limiting_http_429(async_client: AsyncClient, db_session: AsyncSession):
    """Verify login endpoint returns HTTP 429 when rate limit is exceeded."""
    # Seed user
    user = User(
        id="usr_rate_1",
        name="Rate Target",
        email="target@taskflow.dev",
        role=UserRole.MEMBER,
        password_hash=hash_password("RealPassword123!"),
    )
    await user_dao.create(db_session, user)

    # Attempt 5 incorrect logins (up to configured max attempts = 5)
    for _ in range(5):
        res = await async_client.post(
            "/api/auth/login",
            json={"email": user.email, "password": "WrongPasswordAttempt"},
        )
        assert res.status_code == 401

    # 6th attempt must be rejected with HTTP 429 Too Many Requests
    res_exceeded = await async_client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "WrongPasswordAttempt"},
    )
    assert res_exceeded.status_code == 429
    assert "too many" in res_exceeded.json()["message"].lower()


@pytest.mark.asyncio
async def test_rate_limiting_avoids_email_enumeration(async_client: AsyncClient, db_session: AsyncSession):
    """Verify error messages and status codes are identical for existing vs non-existent accounts."""
    user = User(
        id="usr_enum_1",
        name="Existing Account",
        email="existing@taskflow.dev",
        role=UserRole.MEMBER,
        password_hash=hash_password("RealPassword123!"),
    )
    await user_dao.create(db_session, user)

    # Failed login for existing email
    res_existing = await async_client.post(
        "/api/auth/login",
        json={"email": "existing@taskflow.dev", "password": "BadPassword"},
    )
    # Failed login for non-existent email
    res_non_existing = await async_client.post(
        "/api/auth/login",
        json={"email": "doesnotexist@taskflow.dev", "password": "BadPassword"},
    )

    # Both must return identical status code and message
    assert res_existing.status_code == 401
    assert res_non_existing.status_code == 401
    assert res_existing.json()["message"] == res_non_existing.json()["message"]
    assert res_existing.json()["message"] == "Invalid email or password"
