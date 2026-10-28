"""Tests for password security, Argon2id hashing, verification, registration validation, and role protection."""

from httpx import AsyncClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.daos.user_dao import user_dao
from app.models.user import User, UserRole


def test_password_hashing_and_verification():
    """Verify password hashing produces Argon2id hashes and verifies correctly."""
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)

    # 1. Produced hash must start with Argon2id prefix
    assert hashed.startswith("$argon2id$")
    assert hashed != password

    # 2. Correct password verification succeeds
    assert verify_password(password, hashed) is True

    # 3. Incorrect password verification fails securely without crashing
    assert verify_password("WrongPassword123!", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password(password, None) is False
    assert verify_password(password, "corrupted_hash") is False


def test_password_backward_compatibility():
    """Verify historical Bcrypt password hashes are verified seamlessly."""
    # Seed Bcrypt hash for "AdminPass@2026"
    bcrypt_hash = "$2a$08$6MLZwjUPsb.ljnT0PQ02oO9pNhfd.GWctFYTvlldkj/8W19eP4Lyu"
    assert verify_password("AdminPass@2026", bcrypt_hash) is True
    assert verify_password("WrongPass@2026", bcrypt_hash) is False


@pytest.mark.asyncio
async def test_public_registration_disabled(async_client: AsyncClient, db_session: AsyncSession):
    """Verify public registration endpoint is disabled to enforce strict invite-only provisioning."""
    res = await async_client.post(
        "/api/auth/register",
        json={
            "name": "Public Registrant",
            "email": "public@taskflow.dev",
            "password": "ValidPassword123!",
        },
    )
    # /api/auth/register should not exist (404 or 405)
    assert res.status_code in (404, 405)

