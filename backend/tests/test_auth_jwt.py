"""Tests for JWT authentication, signature validation, expiration, and protected endpoints."""

from datetime import timedelta
import time
from httpx import AsyncClient
import jwt
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password
from app.daos.user_dao import user_dao
from app.models.user import User, UserRole


def test_jwt_claims_and_signature():
    """Verify access token contains required claims and valid signature."""
    payload = {
        "sub": "usr_test_123",
        "email": "user@test.dev",
        "role": "MEMBER",
        "name": "Test User",
    }
    token = create_access_token(payload, expires_delta=timedelta(minutes=15))
    decoded = decode_token(token, expected_type="access")

    assert decoded["sub"] == "usr_test_123"
    assert decoded["role"] == "MEMBER"
    assert decoded["type"] == "access"
    assert "jti" in decoded
    assert "exp" in decoded
    assert "iat" in decoded
    assert decoded["exp"] > decoded["iat"]


def test_jwt_expiration():
    """Verify expired token raises 401 AuthenticationException."""
    payload = {"sub": "usr_expired_123", "role": "MEMBER"}
    # Token expired 1 minute ago
    expired_token = create_access_token(payload, expires_delta=timedelta(minutes=-1))

    with pytest.raises(Exception) as excinfo:
        decode_token(expired_token, expected_type="access")
    assert "expired" in str(excinfo.value).lower()


def test_jwt_tampered_signature():
    """Verify token signed with an unauthorized secret is rejected."""
    tampered_token = jwt.encode(
        {"sub": "usr_tampered_123", "type": "access", "iat": int(time.time()), "exp": int(time.time() + 3600)},
        "attacker-secret-key-attacker-secret-key",
        algorithm="HS256",
    )
    with pytest.raises(Exception) as excinfo:
        decode_token(tampered_token, expected_type="access")
    assert "invalid" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_protected_endpoints_with_jwt(async_client: AsyncClient, db_session: AsyncSession):
    """Verify HTTP behavior for missing, expired, and valid JWT tokens."""
    # Seed user in database
    user = User(
        id="u_jwt_test",
        name="JWT Tester",
        email="jwt@taskflow.dev",
        role=UserRole.MEMBER,
        password_hash=hash_password("Password123!"),
    )
    await user_dao.create(db_session, user)

    # 1. Missing Authorization header returns 401
    res_no_auth = await async_client.get("/api/auth/me")
    assert res_no_auth.status_code == 401
    assert "unauthorized" in res_no_auth.json()["message"].lower()

    # 2. Malformed token returns 401
    res_bad_auth = await async_client.get("/api/auth/me", headers={"Authorization": "Bearer bad.token.here"})
    assert res_bad_auth.status_code == 401

    # 3. Expired token returns 401
    expired_token = create_access_token({"sub": user.id, "role": user.role.value}, expires_delta=timedelta(minutes=-5))
    res_exp = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res_exp.status_code == 401
    assert "expired" in res_exp.json()["message"].lower()

    # 4. Wrong token type (presenting refresh token to access endpoint) returns 401
    refresh_tok, _ = create_refresh_token(user_id=user.id, session_id="ses_123")
    res_wrong_type = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {refresh_tok}"})
    assert res_wrong_type.status_code == 401

    # 5. Token for non-existent user returns 401 (server-side verification)
    orphan_token = create_access_token({"sub": "non_existent_user_id", "role": "MEMBER"})
    res_orphan = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {orphan_token}"})
    assert res_orphan.status_code == 401
    assert "not found" in res_orphan.json()["message"].lower()

    # 6. Valid access token succeeds and returns current user
    valid_token = create_access_token({"sub": user.id, "role": user.role.value})
    res_valid = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {valid_token}"})
    assert res_valid.status_code == 200
    assert res_valid.json()["id"] == user.id
    assert res_valid.json()["email"] == user.email
