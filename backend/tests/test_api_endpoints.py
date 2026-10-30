"""Integration tests for FastAPI HTTP routes and handlers."""

from datetime import date, timedelta
from httpx import AsyncClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.daos.column_dao import column_dao
from app.daos.project_dao import project_dao
from app.daos.user_dao import user_dao
from app.models.column import BoardColumn
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole

ADMIN_HEADERS = {
    "Authorization": "Bearer mock-admin-token",
    "x-user-id": "u_admin_http",
    "x-user-name": "Admin HTTP",
    "x-user-role": "ADMIN",
    "x-user-email": "admin.http@taskflow.dev",
}

MEMBER_HEADERS = {
    "Authorization": "Bearer mock-member-token",
    "x-user-id": "u_member_http",
    "x-user-name": "Member HTTP",
    "x-user-role": "MEMBER",
    "x-user-email": "member.http@taskflow.dev",
}


@pytest.mark.asyncio
async def test_health_endpoint(async_client: AsyncClient):
    """Verify GET /api/health returns operational telemetry."""
    res = await async_client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["appName"] == "TaskFlow"
    assert data["apiHealth"] in ("operational", "degraded")
    assert data["status"] in ("healthy", "degraded")


@pytest.mark.asyncio
async def test_columns_endpoints(async_client: AsyncClient, db_session: AsyncSession):
    """Verify columns endpoints: unauthorized, creation, reordering, and deletion."""
    # 1. Unauthorized request
    res_unauth = await async_client.get("/api/columns")
    assert res_unauth.status_code == 401
    assert "Unauthorized" in res_unauth.json()["message"]

    # Seed baseline columns
    c_todo = BoardColumn(id="TODO", title="To Do", order=0)
    c_done = BoardColumn(id="DONE", title="Done", order=1)
    await column_dao.create(db_session, c_todo)
    await column_dao.create(db_session, c_done)

    # 2. Member cannot create column (403)
    res_forbidden = await async_client.post(
        "/api/columns",
        json={"title": "Custom Dev"},
        headers=MEMBER_HEADERS,
    )
    assert res_forbidden.status_code == 403

    # 3. Admin creates column (201)
    res_created = await async_client.post(
        "/api/columns",
        json={"title": "Custom Dev"},
        headers=ADMIN_HEADERS,
    )
    assert res_created.status_code == 201
    data = res_created.json()
    assert data["id"] == "CUSTOM_DEV"
    assert data["order"] == 2

    # 4. List columns (200)
    res_list = await async_client.get("/api/columns", headers=MEMBER_HEADERS)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 3

    # 5. Reorder columns (200)
    res_reorder = await async_client.post(
        "/api/columns/reorder",
        json={"columnIds": ["CUSTOM_DEV", "TODO", "DONE"]},
        headers=ADMIN_HEADERS,
    )
    assert res_reorder.status_code == 200
    assert [c["id"] for c in res_reorder.json()] == ["CUSTOM_DEV", "TODO", "DONE"]

    # 6. Reorder invalid payload returns { "error": ... } shape
    res_bad_reorder = await async_client.post(
        "/api/columns/reorder",
        json={"columnIds": ["NON_EXISTENT"]},
        headers=ADMIN_HEADERS,
    )
    assert res_bad_reorder.status_code == 400
    assert "error" in res_bad_reorder.json()

    # 7. Delete custom column (200)
    res_del = await async_client.delete("/api/columns/CUSTOM_DEV", headers=ADMIN_HEADERS)
    assert res_del.status_code == 200
    assert res_del.json()["message"] == "Column deleted successfully"


@pytest.mark.asyncio
async def test_projects_crud_endpoints(async_client: AsyncClient, db_session: AsyncSession):
    """Verify project creation, retrieval, updates, and deletion."""
    # Seed admin user
    admin = User(id="u_admin_http", name="Admin HTTP", email="admin.http@taskflow.dev", role=UserRole.ADMIN)
    await user_dao.create(db_session, admin)

    # 1. Create project
    res_create = await async_client.post(
        "/api/projects",
        json={
            "name": "Backend Refactor",
            "key": "BCK",
            "description": "Refactoring core architecture",
        },
        headers=ADMIN_HEADERS,
    )
    assert res_create.status_code == 201
    proj_id = res_create.json()["id"]
    assert res_create.json()["key"] == "BCK"

    # 2. Get project by ID
    res_get = await async_client.get(f"/api/projects/{proj_id}", headers=MEMBER_HEADERS)
    assert res_get.status_code == 200
    assert res_get.json()["name"] == "Backend Refactor"

    # 3. Update project
    res_put = await async_client.put(
        f"/api/projects/{proj_id}",
        json={"description": "Updated project description"},
        headers=ADMIN_HEADERS,
    )
    assert res_put.status_code == 200
    assert res_put.json()["description"] == "Updated project description"

    # 4. Delete project
    res_del = await async_client.delete(f"/api/projects/{proj_id}", headers=ADMIN_HEADERS)
    assert res_del.status_code == 200
    assert res_del.json()["message"] == "Project deleted successfully"


@pytest.mark.asyncio
async def test_tasks_endpoints_and_dashboard(async_client: AsyncClient, db_session: AsyncSession):
    """Verify task lifecycle, state machine error handling, and dashboard stats."""
    # Seed admin user, project, and columns
    admin = User(id="u_admin_http", name="Admin HTTP", email="admin.http@taskflow.dev", role=UserRole.ADMIN)
    await user_dao.create(db_session, admin)

    for cid, title, order in [
        ("TODO", "To Do", 0),
        ("IN_PROGRESS", "In Progress", 1),
        ("IN_REVIEW", "In Review", 2),
        ("DONE", "Done", 3),
    ]:
        await column_dao.create(db_session, BoardColumn(id=cid, title=title, order=order))

    proj = Project(
        id="prj_kpi",
        name="KPI Test",
        key="KPI",
        description="Dashboard testing",
        status=ProjectStatus.ACTIVE,
        owner_id=admin.id,
    )
    await project_dao.create(db_session, proj)

    # 1. Create Task
    res_task = await async_client.post(
        "/api/tasks",
        json={
            "title": "Build Dashboard",
            "description": "KPI Aggregation",
            "projectId": proj.id,
            "status": "TODO",
            "priority": "HIGH",
            "dueDate": str(date.today() + timedelta(days=3)),
        },
        headers=ADMIN_HEADERS,
    )
    assert res_task.status_code == 201
    task_id = res_task.json()["id"]

    # 2. Query tasks with filtering
    res_filter = await async_client.get(
        f"/api/tasks?projectId={proj.id}&status=TODO&priority=HIGH",
        headers=ADMIN_HEADERS,
    )
    assert res_filter.status_code == 200
    assert len(res_filter.json()) == 1

    # 3. Illegal state update: TODO -> DONE returns 400
    res_illegal = await async_client.put(
        f"/api/tasks/{task_id}",
        json={"status": "DONE"},
        headers=ADMIN_HEADERS,
    )
    assert res_illegal.status_code == 400
    assert "Invalid workflow transition" in res_illegal.json()["message"]

    # 4. Legal transition: TODO -> IN_PROGRESS
    res_legal = await async_client.put(
        f"/api/tasks/{task_id}",
        json={"status": "IN_PROGRESS"},
        headers=ADMIN_HEADERS,
    )
    assert res_legal.status_code == 200
    assert res_legal.json()["status"] == "IN_PROGRESS"

    # 5. Dashboard stats endpoint
    res_stats = await async_client.get(
        f"/api/dashboard/stats?projectId={proj.id}",
        headers=ADMIN_HEADERS,
    )
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["totalTasks"] == 1
    assert stats["inProgressTasks"] == 1
    assert stats["completedTasks"] == 0


@pytest.mark.asyncio
async def test_users_endpoints(async_client: AsyncClient, db_session: AsyncSession):
    """Verify user provisioning and management via HTTP."""
    admin = User(id="u_admin_http", name="Admin HTTP", email="admin.http@taskflow.dev", role=UserRole.ADMIN)
    await user_dao.create(db_session, admin)

    # Provision user
    res_prov = await async_client.post(
        "/api/users/create",
        json={
            "name": "Sarah Connor",
            "email": "sarah@cyberdyne.com",
            "role": "MEMBER",
            "designation": "Security Analyst",
        },
        headers=ADMIN_HEADERS,
    )
    assert res_prov.status_code == 201
    prov_data = res_prov.json()
    assert prov_data["user"]["name"] == "Sarah Connor"
    user_id = prov_data["user"]["id"]

    # List users
    res_list = await async_client.get("/api/users", headers=ADMIN_HEADERS)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 2

    # Delete user
    res_del = await async_client.delete(f"/api/users/{user_id}", headers=ADMIN_HEADERS)
    assert res_del.status_code == 200
    assert res_del.json()["message"] == "Team member deleted successfully"


@pytest.mark.asyncio
async def test_activities_endpoint(async_client: AsyncClient, db_session: AsyncSession):
    """Verify GET /api/activities returns logged activities."""
    res = await async_client.get("/api/activities?limit=5", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_missing_resources_return_404(async_client: AsyncClient, db_session: AsyncSession):
    """Verify that non-existent entities return structured 404 responses."""
    # 1. Project 404
    p_res = await async_client.get("/api/projects/unknown_prj", headers=ADMIN_HEADERS)
    assert p_res.status_code == 404
    assert "not found" in p_res.json()["message"].lower()

    # 2. Task 404
    t_res = await async_client.get("/api/tasks/unknown_tsk", headers=ADMIN_HEADERS)
    assert t_res.status_code == 404
    assert "not found" in t_res.json()["message"].lower()

    # 3. User 404
    u_res = await async_client.get("/api/users/unknown_usr", headers=ADMIN_HEADERS)
    assert u_res.status_code == 404
    assert "not found" in u_res.json()["message"].lower()

    # 4. Column 404
    c_res = await async_client.delete("/api/columns/UNKNOWN_COL", headers=ADMIN_HEADERS)
    assert c_res.status_code == 404
    assert "not found" in c_res.json()["message"].lower()



