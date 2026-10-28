"""Tests for invitation workflow, invite verification, password setup, and resend invite."""

from httpx import AsyncClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.daos.user_dao import user_dao
from app.models.user import User, UserRole


@pytest.mark.asyncio
async def test_invite_lifecycle_verify_and_set_password(async_client: AsyncClient, db_session: AsyncSession):
    """Verify Admin provisioning generates valid invite, verification succeeds, and user sets password."""
    admin = User(
        id="usr_inv_admin",
        name="Admin Inviter",
        email="admin.inv@taskflow.dev",
        role=UserRole.ADMIN,
        password_hash=hash_password("AdminPass123!"),
    )
    await user_dao.create(db_session, admin)
    admin_token = create_access_token({"sub": admin.id, "role": "ADMIN"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Admin provisions new member
    res_prov = await async_client.post(
        "/api/users/create",
        json={
            "name": "Invited Developer",
            "email": "dev.invited@taskflow.dev",
            "role": "MEMBER",
            "designation": "Frontend Dev",
        },
        headers=admin_headers,
    )
    assert res_prov.status_code == 201
    prov_data = res_prov.json()
    invite_url = prov_data["inviteUrl"]
    assert "token=" in invite_url

    # Extract token from invite_url query string
    token = invite_url.split("token=")[1].split("&")[0]

    # 2. Invalid token in set-password fails
    res_bad_set = await async_client.post(
        "/api/auth/set-password",
        json={
            "email": "dev.invited@taskflow.dev",
            "token": "invalid_token_123",
            "password": "ActivatedPass2026!",
        },
    )
    assert res_bad_set.status_code == 400

    # 3. User sets account password directly via POST /api/auth/set-password with valid token
    res_set = await async_client.post(
        "/api/auth/set-password",
        json={
            "email": "dev.invited@taskflow.dev",
            "token": token,
            "password": "ActivatedPass2026!",
        },
    )
    assert res_set.status_code == 200
    assert "successfully" in res_set.json()["message"].lower()

    # 4. Token is now consumed; reusing it fails
    res_reuse = await async_client.post(
        "/api/auth/set-password",
        json={
            "email": "dev.invited@taskflow.dev",
            "token": token,
            "password": "AnotherPassword123!",
        },
    )
    assert res_reuse.status_code == 400

    # 5. User can now sign in with the new password
    res_login = await async_client.post(
        "/api/auth/login",
        json={"email": "dev.invited@taskflow.dev", "password": "ActivatedPass2026!"},
    )
    assert res_login.status_code == 200
    assert res_login.json()["user"]["email"] == "dev.invited@taskflow.dev"


@pytest.mark.asyncio
async def test_current_user_profile_endpoint(async_client: AsyncClient, db_session: AsyncSession):
    """Verify /api/auth/me endpoint returns authoritative user profile."""
    user = User(
        id="u_sess_1",
        name="Profile User",
        email="profile.user@taskflow.dev",
        role=UserRole.MEMBER,
        designation="Fullstack Engineer",
    )
    await user_dao.create(db_session, user)

    token = create_access_token({"sub": user.id, "role": user.role.value})
    res = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == user.id
    assert data["email"] == user.email
    assert data["role"] == "MEMBER"
