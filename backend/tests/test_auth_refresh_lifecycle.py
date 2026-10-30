"""Tests for refresh token issuance, rotation, reuse detection, concurrency locks, and revocation."""

import json
from httpx import AsyncClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import set_redis_client
from app.core.redis_session import RedisSessionService, redis_session_service
from app.core.security import hash_password
from app.daos.user_dao import user_dao
from app.models.user import User, UserRole
from tests.fake_redis import FakeRedis


@pytest.fixture(autouse=True)
def setup_fake_redis():
    """Configures in-memory FakeRedis test double for session lifecycle testing."""
    fake_client = FakeRedis()
    set_redis_client(fake_client)
    redis_session_service._redis = fake_client
    yield fake_client
    set_redis_client(None)
    redis_session_service._redis = None


@pytest.mark.asyncio
async def test_refresh_token_issuance_and_storage(async_client: AsyncClient, db_session: AsyncSession, setup_fake_redis: FakeRedis):
    """Verify refresh token issuance and secure SHA-256 hash storage in Redis."""
    # Seed user
    user = User(
        id="usr_refresh_1",
        name="Refresh Tester",
        email="refresh1@taskflow.dev",
        role=UserRole.MEMBER,
        password_hash=hash_password("ValidPassword123!"),
    )
    await user_dao.create(db_session, user)

    # Login to receive access and refresh tokens
    login_res = await async_client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "ValidPassword123!"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "refreshToken" in login_data
    assert "accessToken" in login_data
    refresh_token = login_data["refreshToken"]

    # Verify that raw refresh token is NEVER stored in Redis
    for key, val in setup_fake_redis._data.items():
        if key.startswith("taskflow:session:"):
            session_data = json.loads(val)
            assert session_data["current_token_hash"] != refresh_token
            # Verify the hash is a 64-char SHA256 hex string
            assert len(session_data["current_token_hash"]) == 64


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_invalidation(async_client: AsyncClient, db_session: AsyncSession, setup_fake_redis: FakeRedis):
    """Verify refresh-token rotation: previous token invalidated and new token issued."""
    user = User(
        id="usr_rotation_1",
        name="Rotation User",
        email="rotation@taskflow.dev",
        role=UserRole.MEMBER,
        password_hash=hash_password("ValidPassword123!"),
    )
    await user_dao.create(db_session, user)

    # 1. Login to get initial refresh token
    login_res = await async_client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "ValidPassword123!"},
    )
    token_v1 = login_res.json()["refreshToken"]

    # 2. Rotate token via /api/auth/refresh
    refresh_res = await async_client.post(
        "/api/auth/refresh",
        json={"refreshToken": token_v1},
    )
    assert refresh_res.status_code == 200
    data_v2 = refresh_res.json()
    token_v2 = data_v2["refreshToken"]
    access_v2 = data_v2["accessToken"]

    assert token_v2 != token_v1
    assert access_v2 is not None

    # 3. New access token works
    me_res = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {access_v2}"})
    assert me_res.status_code == 200
    assert me_res.json()["id"] == user.id


@pytest.mark.asyncio
async def test_refresh_token_reuse_detection(async_client: AsyncClient, db_session: AsyncSession, setup_fake_redis: FakeRedis):
    """Verify that reusing a previously rotated token triggers reuse detection and revokes the session."""
    user = User(
        id="usr_reuse_1",
        name="Reuse User",
        email="reuse@taskflow.dev",
        role=UserRole.MEMBER,
        password_hash=hash_password("ValidPassword123!"),
    )
    await user_dao.create(db_session, user)

    # 1. Login
    login_res = await async_client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "ValidPassword123!"},
    )
    token_v1 = login_res.json()["refreshToken"]

    # 2. Legitimate rotation: v1 -> v2
    rot_res = await async_client.post(
        "/api/auth/refresh",
        json={"refreshToken": token_v1},
    )
    assert rot_res.status_code == 200
    token_v2 = rot_res.json()["refreshToken"]

    # 3. Attacker replays stolen old token_v1:
    # Must detect REUSE, revoke entire session, and return 401
    replay_res = await async_client.post(
        "/api/auth/refresh",
        json={"refreshToken": token_v1},
    )
    assert replay_res.status_code == 401
    assert "reuse detected" in replay_res.json()["message"].lower()

    # 4. Legitimate token_v2 is now ALSO revoked due to session compromise!
    followup_res = await async_client.post(
        "/api/auth/refresh",
        json={"refreshToken": token_v2},
    )
    assert followup_res.status_code == 401
    assert "revoked" in followup_res.json()["message"].lower()


@pytest.mark.asyncio
async def test_concurrent_refresh_lock_protection(setup_fake_redis: FakeRedis):
    """Verify that concurrent refresh attempts on the same session are blocked by lock protection."""
    service = RedisSessionService(setup_fake_redis)
    refresh_tok, session_id, _ = await service.create_session("usr_lock_test")

    # Manually hold lock on this session
    lock_key = f"taskflow:lock:session:{session_id}"
    await setup_fake_redis.set(lock_key, "1", px=10000)

    # Attempting to rotate while lock is held must raise AuthenticationException (concurrency protection)
    with pytest.raises(Exception) as excinfo:
        await service.rotate_refresh_token(refresh_tok)
    assert "concurrent" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_logout_and_session_revocation(async_client: AsyncClient, db_session: AsyncSession, setup_fake_redis: FakeRedis):
    """Verify logout revokes active session in Redis and prevents subsequent token refresh."""
    user = User(
        id="usr_logout_1",
        name="Logout User",
        email="logout@taskflow.dev",
        role=UserRole.MEMBER,
        password_hash=hash_password("ValidPassword123!"),
    )
    await user_dao.create(db_session, user)

    # 1. Login
    login_res = await async_client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "ValidPassword123!"},
    )
    refresh_tok = login_res.json()["refreshToken"]
    access_tok = login_res.json()["accessToken"]

    # 2. Logout
    logout_res = await async_client.post(
        "/api/auth/logout",
        json={"refreshToken": refresh_tok},
        headers={"Authorization": f"Bearer {access_tok}"},
    )
    assert logout_res.status_code == 200
    assert "logged out" in logout_res.json()["message"].lower()

    # 3. Attempting to refresh with revoked token returns 401
    ref_res = await async_client.post(
        "/api/auth/refresh",
        json={"refreshToken": refresh_tok},
    )
    assert ref_res.status_code == 401
