"""Tests for Role-Based Access Control (RBAC) and object-level authorization."""

from datetime import date, timedelta
from httpx import AsyncClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.daos.column_dao import column_dao
from app.daos.project_dao import project_dao
from app.daos.task_dao import task_dao
from app.daos.user_dao import user_dao
from app.models.column import BoardColumn
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority
from app.models.user import User, UserRole


@pytest.mark.asyncio
async def test_rbac_admin_vs_member_project_actions(async_client: AsyncClient, db_session: AsyncSession):
    """Verify Admin can create and delete projects while Member is rejected with 403 Forbidden."""
    # Seed Admin and Member
    admin = User(
        id="usr_rbac_admin",
        name="Admin Boss",
        email="admin.boss@taskflow.dev",
        role=UserRole.ADMIN,
        password_hash=hash_password("Pass123!"),
    )
    member = User(
        id="usr_rbac_member",
        name="Member Staff",
        email="member.staff@taskflow.dev",
        role=UserRole.MEMBER,
        password_hash=hash_password("Pass123!"),
    )
    await user_dao.create(db_session, admin)
    await user_dao.create(db_session, member)

    admin_token = create_access_token({"sub": admin.id, "role": "ADMIN"})
    member_token = create_access_token({"sub": member.id, "role": "MEMBER"})

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Member CANNOT create project (403 Forbidden)
    res_mem_create = await async_client.post(
        "/api/projects",
        json={"name": "Member Project", "key": "MEM", "description": "Forbidden"},
        headers=member_headers,
    )
    assert res_mem_create.status_code == 403
    assert "administrator" in res_mem_create.json()["message"].lower()

    # 2. Admin CAN create project (201 Created)
    res_adm_create = await async_client.post(
        "/api/projects",
        json={"name": "Admin Project", "key": "ADM", "description": "Allowed"},
        headers=admin_headers,
    )
    assert res_adm_create.status_code == 201
    proj_id = res_adm_create.json()["id"]

    # 3. Member CANNOT delete project (403 Forbidden)
    res_mem_del = await async_client.delete(f"/api/projects/{proj_id}", headers=member_headers)
    assert res_mem_del.status_code == 403

    # 4. Admin CAN delete project (200 OK)
    res_adm_del = await async_client.delete(f"/api/projects/{proj_id}", headers=admin_headers)
    assert res_adm_del.status_code == 200


@pytest.mark.asyncio
async def test_rbac_admin_vs_member_column_actions(async_client: AsyncClient, db_session: AsyncSession):
    """Verify Column configuration (creation, reorder, delete) is restricted to Admins (403 for Members)."""
    admin = User(id="u_col_admin", name="Admin Col", email="admin.col@taskflow.dev", role=UserRole.ADMIN)
    member = User(id="u_col_member", name="Member Col", email="member.col@taskflow.dev", role=UserRole.MEMBER)
    await user_dao.create(db_session, admin)
    await user_dao.create(db_session, member)

    admin_token = create_access_token({"sub": admin.id, "role": "ADMIN"})
    member_token = create_access_token({"sub": member.id, "role": "MEMBER"})

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Member cannot create column (403)
    res_create = await async_client.post(
        "/api/columns",
        json={"title": "QA Column"},
        headers=member_headers,
    )
    assert res_create.status_code == 403

    # 2. Member cannot reorder columns (403)
    res_reorder = await async_client.post(
        "/api/columns/reorder",
        json={"columnIds": ["TODO", "DONE"]},
        headers=member_headers,
    )
    assert res_reorder.status_code == 403

    # 3. Member cannot delete columns (403)
    res_del = await async_client.delete("/api/columns/TODO", headers=member_headers)
    assert res_del.status_code == 403


@pytest.mark.asyncio
async def test_object_level_task_permissions(async_client: AsyncClient, db_session: AsyncSession):
    """Verify object-level task access control: members can only modify assigned or created tasks."""
    admin = User(id="u_tsk_admin", name="Admin Task", email="admin.task@taskflow.dev", role=UserRole.ADMIN)
    member1 = User(id="u_tsk_mem1", name="Member One", email="mem1@taskflow.dev", role=UserRole.MEMBER)
    member2 = User(id="u_tsk_mem2", name="Member Two", email="mem2@taskflow.dev", role=UserRole.MEMBER)
    await user_dao.create(db_session, admin)
    await user_dao.create(db_session, member1)
    await user_dao.create(db_session, member2)

    c_todo = BoardColumn(id="TODO", title="To Do", order=0)
    c_prog = BoardColumn(id="IN_PROGRESS", title="In Progress", order=1)
    await column_dao.create(db_session, c_todo)
    await column_dao.create(db_session, c_prog)

    proj = Project(
        id="prj_obj_rbac",
        name="Object RBAC",
        key="OBJ",
        description="Object level testing",
        status=ProjectStatus.ACTIVE,
        owner_id=admin.id,
        members=[admin, member1, member2],
    )
    await project_dao.create(db_session, proj)

    # Task assigned to member1
    task1 = Task(
        id="OBJ-000001",
        title="Member 1 Task",
        description="Assigned to member1",
        status="TODO",
        priority=TaskPriority.MEDIUM,
        due_date=date.today() + timedelta(days=5),
        project_id=proj.id,
        assignee_id=member1.id,
        created_by_id=admin.id,
    )
    await task_dao.create(db_session, task1)

    m1_token = create_access_token({"sub": member1.id, "role": "MEMBER"})
    m2_token = create_access_token({"sub": member2.id, "role": "MEMBER"})
    admin_token = create_access_token({"sub": admin.id, "role": "ADMIN"})

    m1_headers = {"Authorization": f"Bearer {m1_token}"}
    m2_headers = {"Authorization": f"Bearer {m2_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Member 2 tries to edit task assigned to Member 1 -> 403 Forbidden
    res_m2_edit = await async_client.put(
        f"/api/tasks/{task1.id}",
        json={"title": "Unauthorized Modification"},
        headers=m2_headers,
    )
    assert res_m2_edit.status_code == 403
    assert "assigned to you" in res_m2_edit.json()["message"].lower()

    # 2. Member 1 (the assignee) CAN edit the task -> 200 OK
    res_m1_edit = await async_client.put(
        f"/api/tasks/{task1.id}",
        json={"status": "IN_PROGRESS"},
        headers=m1_headers,
    )
    assert res_m1_edit.status_code == 200
    assert res_m1_edit.json()["status"] == "IN_PROGRESS"

    # 3. Member cannot delete task -> 403 Forbidden
    res_m1_del = await async_client.delete(f"/api/tasks/{task1.id}", headers=m1_headers)
    assert res_m1_del.status_code == 403

    # 4. Admin CAN delete task -> 200 OK
    res_adm_del = await async_client.delete(f"/api/tasks/{task1.id}", headers=admin_headers)
    assert res_adm_del.status_code == 200
