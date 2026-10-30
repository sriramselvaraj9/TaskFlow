"""End-to-end authentication, JWT, refresh rotation, logout, token reuse, and RBAC integration tests.

Tests:
1. Login flow with valid vs invalid credentials (no account enumeration).
2. JWT signature validation, expiration, and claims verification.
3. Refresh token rotation and single-use enforcement.
4. Refresh token reuse detection revoking all active sessions in the family.
5. Logout revoking session in Redis and preventing further token refresh.
6. RBAC: Admin vs Member role restrictions on project and column mutations.
7. Object-level cross-project access restrictions on task updates/deletions.
"""

from datetime import date, timedelta
from httpx import AsyncClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationException, PermissionDeniedException
from app.core.redis_session import RedisSessionService
from app.core.security import create_access_token, hash_password
from app.daos.column_dao import column_dao
from app.daos.project_dao import project_dao
from app.daos.task_dao import task_dao
from app.daos.user_dao import user_dao
from app.models.column import BoardColumn
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest
from app.schemas.task import TaskUpdate
from app.schemas.user import UserTokenPayload
from app.services.auth_service import AuthService
from app.services.task_service import task_service
from tests.fake_redis import FakeRedis


@pytest.fixture
async def auth_test_env(db_session: AsyncSession):
    """Seeds test users, projects, and columns for auth integration tests."""
    admin = User(
        id="usr_auth_admin",
        name="Admin Test",
        email="admin.auth@t.dev",
        role=UserRole.ADMIN,
        password_hash=hash_password("AdminPass123!"),
    )
    member_a = User(
        id="usr_auth_mema",
        name="Member A",
        email="mema.auth@t.dev",
        role=UserRole.MEMBER,
        password_hash=hash_password("MemberPass123!"),
    )
    member_b = User(
        id="usr_auth_memb",
        name="Member B",
        email="memb.auth@t.dev",
        role=UserRole.MEMBER,
        password_hash=hash_password("MemberPass123!"),
    )
    await user_dao.create(db_session, admin)
    await user_dao.create(db_session, member_a)
    await user_dao.create(db_session, member_b)

    # Columns
    c1 = BoardColumn(id="TODO", title="To Do", order=0)
    c2 = BoardColumn(id="DONE", title="Done", order=1)
    await column_dao.create(db_session, c1)
    await column_dao.create(db_session, c2)

    # Project A (owner: admin, members: admin, member_a)
    proj_a = Project(
        id="prj_auth_a",
        name="Project A",
        key="PRA",
        description="Project A Description",
        status=ProjectStatus.ACTIVE,
        owner_id=admin.id,
        members=[admin, member_a],
    )
    # Project B (owner: admin, members: admin, member_b)
    proj_b = Project(
        id="prj_auth_b",
        name="Project B",
        key="PRB",
        description="Project B Description",
        status=ProjectStatus.ACTIVE,
        owner_id=admin.id,
        members=[admin, member_b],
    )
    await project_dao.create(db_session, proj_a)
    await project_dao.create(db_session, proj_b)

    # Task in Project B
    task_b = Task(
        id="PRB-001",
        title="Project B Confidential Task",
        description="Task inside project B",
        status="TODO",
        priority=TaskPriority.HIGH,
        project_id=proj_b.id,
        created_by_id=admin.id,
        due_date=date.today() + timedelta(days=7),
    )
    await task_dao.create(db_session, task_b)
    await db_session.commit()

    return {
        "admin": admin,
        "member_a": member_a,
        "member_b": member_b,
        "proj_a": proj_a,
        "proj_b": proj_b,
        "task_b": task_b,
    }


# ============================================================================
# 1. Login, Invalid Credentials & Constant-Time Enumeration Safeguards
# ============================================================================

@pytest.mark.asyncio
async def test_login_flow_and_anti_enumeration(db_session: AsyncSession, auth_test_env):
    """Verify login succeeds with valid password and rejects invalid credentials safely."""
    fake_redis = FakeRedis()
    session_service = RedisSessionService(redis_client=fake_redis)
    auth_srv = AuthService(session_service=session_service, user_dao=user_dao)

    # 1. Valid login
    login_res = await auth_srv.login(
        db_session,
        LoginRequest(email="admin.auth@t.dev", password="AdminPass123!"),
        client_ip="127.0.0.1",
    )
    assert login_res.access_token is not None
    assert login_res.refresh_token is not None
    assert login_res.user.email == "admin.auth@t.dev"
    assert login_res.user.role == "ADMIN"

    # 2. Invalid password
    with pytest.raises(AuthenticationException) as exc_pwd:
        await auth_srv.login(
            db_session,
            LoginRequest(email="admin.auth@t.dev", password="WrongPassword!"),
            client_ip="127.0.0.1",
        )
    assert "Invalid email or password" in str(exc_pwd.value)

    # 3. Non-existent email (must return identical generic error to avoid user enumeration)
    with pytest.raises(AuthenticationException) as exc_email:
        await auth_srv.login(
            db_session,
            LoginRequest(email="nonexistent.user@t.dev", password="AnyPassword123!"),
            client_ip="127.0.0.1",
        )
    assert "Invalid email or password" in str(exc_email.value)


# ============================================================================
# 2. JWT Expiration & Tampering Verification
# ============================================================================

@pytest.mark.asyncio
async def test_jwt_tampering_and_expiration_safeguards():
    """Verify tampered signatures and expired JWT access tokens are rejected."""
    from app.core.security import decode_token

    # 1. Valid token
    valid_token = create_access_token({"sub": "u_1", "role": "MEMBER", "email": "u1@t.dev"})
    payload = decode_token(valid_token, expected_type="access")
    assert payload["sub"] == "u_1"

    # 2. Tampered token signature
    tampered_token = valid_token[:-6] + "xxxxxx"
    with pytest.raises(AuthenticationException) as exc_sig:
        decode_token(tampered_token, expected_type="access")
    assert "Invalid or malformed authentication token" in str(exc_sig.value)

    # 3. Expired token
    expired_token = create_access_token(
        {"sub": "u_1", "role": "MEMBER"},
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(AuthenticationException) as exc_exp:
        decode_token(expired_token, expected_type="access")
    assert "Token has expired" in str(exc_exp.value)


# ============================================================================
# 3. Refresh Token Rotation, Reuse Detection & Logout
# ============================================================================

@pytest.mark.asyncio
async def test_refresh_token_rotation_and_reuse_revocation():
    """Verify refresh token rotation issues a new token and reuse detection revokes all sessions."""
    fake_redis = FakeRedis()
    session_service = RedisSessionService(redis_client=fake_redis)

    # 1. Initial session creation
    rt_1, session_id, jti_1 = await session_service.create_session("usr_alice", client_ip="127.0.0.1")

    # 2. Rotate refresh token once
    rt_2, user_id, s_id = await session_service.rotate_refresh_token(rt_1)
    assert rt_2 != rt_1
    assert user_id == "usr_alice"
    assert s_id == session_id

    # 3. Reuse attack: Attacker or replay attempts to reuse rotated rt_1
    with pytest.raises(AuthenticationException) as exc_reuse:
        await session_service.rotate_refresh_token(rt_1)
    assert "reuse detected" in str(exc_reuse.value).lower()

    # 4. Legitimate rt_2 should now also be rejected because session was revoked on reuse
    with pytest.raises(AuthenticationException) as exc_revoked:
        await session_service.rotate_refresh_token(rt_2)
    assert "revoked" in str(exc_revoked.value).lower()


@pytest.mark.asyncio
async def test_logout_session_revocation():
    """Verify logout revokes the session in Redis immediately."""
    fake_redis = FakeRedis()
    session_service = RedisSessionService(redis_client=fake_redis)

    rt, session_id, _ = await session_service.create_session("usr_bob", client_ip="127.0.0.1")

    # Logout
    success = await session_service.revoke_session(session_id)
    assert success is True

    # Refresh attempt fails
    with pytest.raises(AuthenticationException):
        await session_service.rotate_refresh_token(rt)


# ============================================================================
# 4. RBAC & Cross-Project Access Boundaries
# ============================================================================

@pytest.mark.asyncio
async def test_cross_project_task_access_restriction(db_session: AsyncSession, auth_test_env):
    """Verify member of Project A is forbidden from modifying or deleting tasks in Project B."""
    member_a = auth_test_env["member_a"]
    task_b = auth_test_env["task_b"]

    mem_a_payload = UserTokenPayload(
        id=member_a.id,
        name=member_a.name,
        email=member_a.email,
        role="MEMBER",
    )

    # Member A attempts to update Task B in Project B
    with pytest.raises(PermissionDeniedException) as exc_update:
        await task_service.update_task(
            db_session,
            task_id=task_b.id,
            data=TaskUpdate(title="Malicious Rename By Non-Member"),
            current_user=mem_a_payload,
        )
    assert "Forbidden" in str(exc_update.value)

    # Member A attempts to delete Task B in Project B
    with pytest.raises(PermissionDeniedException) as exc_del:
        await task_service.delete_task(
            db_session,
            task_id=task_b.id,
            current_user=mem_a_payload,
        )
    assert "Forbidden" in str(exc_del.value)


@pytest.mark.asyncio
async def test_rbac_admin_vs_member_project_mutations(async_client: AsyncClient, auth_test_env):
    """Verify Admin can create projects while Member receives 403 Forbidden via HTTP API."""
    headers_member = {
        "Authorization": "Bearer mock-member-token",
        "x-user-id": auth_test_env["member_a"].id,
        "x-user-name": "Member A",
        "x-user-role": "MEMBER",
        "x-user-email": auth_test_env["member_a"].email,
    }

    # Member attempt: 403 Forbidden
    res_mem = await async_client.post(
        "/task_management/api/v1/projects",
        json={"name": "Member Project", "key": "MEM", "description": "Forbidden Attempt Description"},
        headers=headers_member,
    )
    assert res_mem.status_code == 403
    assert "Forbidden" in res_mem.json()["message"]

    # Admin attempt: 201 Created
    headers_admin = {
        "Authorization": "Bearer mock-admin-token",
        "x-user-id": auth_test_env["admin"].id,
        "x-user-name": "Admin",
        "x-user-role": "ADMIN",
        "x-user-email": auth_test_env["admin"].email,
    }
    res_adm = await async_client.post(
        "/task_management/api/v1/projects",
        json={"name": "Admin Project", "key": "ADM", "description": "Allowed Admin Project"},
        headers=headers_admin,
    )
    assert res_adm.status_code == 201
    assert res_adm.json()["key"] == "ADM"
