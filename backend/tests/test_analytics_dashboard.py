"""Dashboard and analytics calculations against deterministic known dataset.

Tests:
1. Exact calculation of total tasks, completed tasks, in-progress tasks, and completion rate.
2. Accurate overdue calculation: tasks due before current date that are NOT DONE are counted; completed tasks are NOT counted.
3. Accurate status distribution and priority distribution maps.
4. Active projects count ignoring archived projects.
5. User-scoped assigned_to_me calculation.
6. Project-scoped filtering of metrics.
7. Authorization boundaries: non-member access to private project dashboard yields 403 Forbidden.
8. API response contract matching DashboardStatsResponse via HTTP.
"""

from datetime import date, timedelta
from httpx import AsyncClient
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PermissionDeniedException
from app.daos.column_dao import column_dao
from app.daos.project_dao import project_dao
from app.daos.task_dao import task_dao
from app.daos.user_dao import user_dao
from app.models.column import BoardColumn
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority
from app.models.user import User, UserRole
from app.schemas.user import UserTokenPayload
from app.services.dashboard_service import dashboard_service


@pytest.fixture
async def seeded_dashboard_data(db_session: AsyncSession):
    """Seeds a known, deterministic dataset with 3 users, 3 projects, and 10 tasks."""
    today = date.today()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    # 1. Users
    admin = User(id="u_dash_admin", name="Admin User", email="admin.dash@t.dev", role=UserRole.ADMIN)
    member1 = User(id="u_dash_mem1", name="Member 1", email="mem1.dash@t.dev", role=UserRole.MEMBER)
    member2 = User(id="u_dash_mem2", name="Member 2", email="mem2.dash@t.dev", role=UserRole.MEMBER)
    await user_dao.create(db_session, admin)
    await user_dao.create(db_session, member1)
    await user_dao.create(db_session, member2)

    # 2. Columns
    for cid, title, order in [
        ("BACKLOG", "Backlog", 0),
        ("TODO", "To Do", 1),
        ("IN_PROGRESS", "In Progress", 2),
        ("IN_REVIEW", "In Review", 3),
        ("DONE", "Done", 4),
    ]:
        await column_dao.create(db_session, BoardColumn(id=cid, title=title, order=order))

    # 3. Projects: 2 ACTIVE, 1 ARCHIVED
    p1 = Project(
        id="p_alpha",
        name="Project Alpha",
        key="ALP",
        description="Alpha project",
        status=ProjectStatus.ACTIVE,
        owner_id=admin.id,
        members=[admin, member1],
    )
    p2 = Project(
        id="p_beta",
        name="Project Beta",
        key="BET",
        description="Beta project",
        status=ProjectStatus.ACTIVE,
        owner_id=admin.id,
        members=[admin, member2],
    )
    p3_archived = Project(
        id="p_gamma",
        name="Project Gamma",
        key="GAM",
        description="Archived project",
        status=ProjectStatus.ARCHIVED,
        owner_id=admin.id,
        members=[admin],
    )
    await project_dao.create(db_session, p1)
    await project_dao.create(db_session, p2)
    await project_dao.create(db_session, p3_archived)

    # 4. Tasks in Project Alpha (5 tasks assigned to member1)
    t1 = Task(id="ALP-1", title="Alpha Done Past", description="Desc", status="DONE", priority=TaskPriority.HIGH, project_id=p1.id, assignee_id=member1.id, created_by_id=admin.id, due_date=yesterday)
    t2 = Task(id="ALP-2", title="Alpha Done Future", description="Desc", status="DONE", priority=TaskPriority.MEDIUM, project_id=p1.id, assignee_id=member1.id, created_by_id=admin.id, due_date=tomorrow)
    t3 = Task(id="ALP-3", title="Alpha In Progress", description="Desc", status="IN_PROGRESS", priority=TaskPriority.HIGH, project_id=p1.id, assignee_id=member1.id, created_by_id=admin.id, due_date=tomorrow)
    t4 = Task(id="ALP-4", title="Alpha Todo Overdue", description="Desc", status="TODO", priority=TaskPriority.LOW, project_id=p1.id, assignee_id=member1.id, created_by_id=admin.id, due_date=yesterday)
    t5 = Task(id="ALP-5", title="Alpha Backlog Future", description="Desc", status="BACKLOG", priority=TaskPriority.LOW, project_id=p1.id, assignee_id=member1.id, created_by_id=admin.id, due_date=tomorrow)

    # Tasks in Project Beta (5 tasks assigned to member2)
    t6 = Task(id="BET-1", title="Beta Done 1", description="Desc", status="DONE", priority=TaskPriority.HIGH, project_id=p2.id, assignee_id=member2.id, created_by_id=admin.id, due_date=tomorrow)
    t7 = Task(id="BET-2", title="Beta Done 2", description="Desc", status="DONE", priority=TaskPriority.MEDIUM, project_id=p2.id, assignee_id=member2.id, created_by_id=admin.id, due_date=tomorrow)
    t8 = Task(id="BET-3", title="Beta In Progress Overdue", description="Desc", status="IN_PROGRESS", priority=TaskPriority.MEDIUM, project_id=p2.id, assignee_id=member2.id, created_by_id=admin.id, due_date=yesterday)
    t9 = Task(id="BET-4", title="Beta In Progress Future", description="Desc", status="IN_PROGRESS", priority=TaskPriority.MEDIUM, project_id=p2.id, assignee_id=member2.id, created_by_id=admin.id, due_date=tomorrow)
    t10 = Task(id="BET-5", title="Beta Todo Future", description="Desc", status="TODO", priority=TaskPriority.LOW, project_id=p2.id, assignee_id=member2.id, created_by_id=admin.id, due_date=tomorrow)

    for task in [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10]:
        await task_dao.create(db_session, task)

    await db_session.commit()
    return {"admin": admin, "member1": member1, "member2": member2, "p1": p1, "p2": p2}


@pytest.mark.asyncio
async def test_global_dashboard_metrics_calculation(db_session: AsyncSession, seeded_dashboard_data):
    """Verify aggregated workspace KPI math matches the known deterministic state."""
    admin_payload = UserTokenPayload(
        id=seeded_dashboard_data["admin"].id,
        name="Admin",
        email="admin.dash@t.dev",
        role="ADMIN",
    )

    stats = await dashboard_service.get_dashboard_stats(db_session, current_user=admin_payload)

    # 10 tasks total, 4 DONE, 3 IN_PROGRESS, 2 TODO, 1 BACKLOG
    assert stats.total_tasks == 10
    assert stats.completed_tasks == 4
    assert stats.in_progress_tasks == 3
    assert stats.completion_rate == 40  # 4 / 10 * 100

    # Overdue tasks: ALP-4 (TODO, yesterday) and BET-3 (IN_PROGRESS, yesterday).
    # ALP-1 is DONE with yesterday's due date, so it MUST NOT be counted as overdue!
    assert stats.overdue_tasks == 2
    assert stats.overdue_count == 2

    # Active projects: 2 active (Alpha, Beta), Gamma is ARCHIVED
    assert stats.active_projects == 2

    # Status distribution
    assert stats.tasks_by_status == {
        "BACKLOG": 1,
        "TODO": 2,
        "IN_PROGRESS": 3,
        "IN_REVIEW": 0,
        "DONE": 4,
    }

    # Priority distribution: 3 HIGH (ALP-1, ALP-3, BET-1), 4 MEDIUM (ALP-2, BET-2, BET-3, BET-4), 3 LOW (ALP-4, ALP-5, BET-5)
    assert stats.tasks_by_priority == {
        "HIGH": 3,
        "MEDIUM": 4,
        "LOW": 3,
    }


@pytest.mark.asyncio
async def test_user_scoped_assigned_to_me_metric(db_session: AsyncSession, seeded_dashboard_data):
    """Verify assigned_to_me reflects active uncompleted tasks assigned to the authenticated user."""
    mem1_payload = UserTokenPayload(
        id=seeded_dashboard_data["member1"].id,
        name="Member 1",
        email="mem1.dash@t.dev",
        role="MEMBER",
    )
    # member1 has 5 tasks total: 2 DONE and 3 active (IN_PROGRESS, TODO, BACKLOG)
    stats1 = await dashboard_service.get_dashboard_stats(db_session, current_user=mem1_payload)
    assert stats1.assigned_to_me == 3

    mem2_payload = UserTokenPayload(
        id=seeded_dashboard_data["member2"].id,
        name="Member 2",
        email="mem2.dash@t.dev",
        role="MEMBER",
    )
    # member2 has 5 tasks total: 2 DONE and 3 active (2 IN_PROGRESS, 1 TODO)
    stats2 = await dashboard_service.get_dashboard_stats(db_session, current_user=mem2_payload)
    assert stats2.assigned_to_me == 3


@pytest.mark.asyncio
async def test_project_filtered_dashboard_metrics(db_session: AsyncSession, seeded_dashboard_data):
    """Verify metrics filter down specifically to a single project when project_id is provided."""
    admin_payload = UserTokenPayload(
        id=seeded_dashboard_data["admin"].id,
        name="Admin",
        email="admin.dash@t.dev",
        role="ADMIN",
    )
    p1_id = seeded_dashboard_data["p1"].id

    stats_p1 = await dashboard_service.get_dashboard_stats(
        db_session, current_user=admin_payload, project_id=p1_id
    )

    assert stats_p1.total_tasks == 5
    assert stats_p1.completed_tasks == 2
    assert stats_p1.in_progress_tasks == 1
    assert stats_p1.completion_rate == 40  # 2 / 5 * 100
    assert stats_p1.overdue_tasks == 1  # only ALP-4

    assert stats_p1.tasks_by_status == {
        "BACKLOG": 1,
        "TODO": 1,
        "IN_PROGRESS": 1,
        "IN_REVIEW": 0,
        "DONE": 2,
    }
    assert stats_p1.tasks_by_priority == {
        "HIGH": 2,
        "MEDIUM": 1,
        "LOW": 2,
    }


@pytest.mark.asyncio
async def test_dashboard_cross_project_authorization_safeguard(db_session: AsyncSession, seeded_dashboard_data):
    """Verify non-admin member cannot inspect dashboard metrics for a project they do not belong to."""
    mem1_payload = UserTokenPayload(
        id=seeded_dashboard_data["member1"].id,
        name="Member 1",
        email="mem1.dash@t.dev",
        role="MEMBER",
    )
    # member1 is enrolled in Project Alpha, NOT Beta
    p2_id = seeded_dashboard_data["p2"].id

    with pytest.raises(PermissionDeniedException) as exc:
        await dashboard_service.get_dashboard_stats(
            db_session, current_user=mem1_payload, project_id=p2_id
        )
    assert "Forbidden" in str(exc.value)


@pytest.mark.asyncio
async def test_dashboard_api_http_endpoint_integration(async_client: AsyncClient, seeded_dashboard_data):
    """Verify GET /api/dashboard/stats through FastAPI HTTP routing."""
    headers_admin = {
        "Authorization": "Bearer mock-admin-token",
        "x-user-id": seeded_dashboard_data["admin"].id,
        "x-user-name": "Admin",
        "x-user-role": "ADMIN",
        "x-user-email": "admin.dash@t.dev",
    }

    # 1. Global dashboard
    res = await async_client.get("/task_management/api/v1/dashboard/stats", headers=headers_admin)
    assert res.status_code == 200
    data = res.json()
    assert data["totalTasks"] == 10
    assert data["completedTasks"] == 4
    assert data["inProgressTasks"] == 3
    assert data["completionRate"] == 40
    assert data["activeProjects"] == 2

    # 2. Project scoped
    p1_id = seeded_dashboard_data["p1"].id
    res_p1 = await async_client.get(f"/task_management/api/v1/dashboard/stats?projectId={p1_id}", headers=headers_admin)
    assert res_p1.status_code == 200
    data_p1 = res_p1.json()
    assert data_p1["totalTasks"] == 5
    assert data_p1["completedTasks"] == 2

    # 3. Forbidden project query by non-member
    headers_mem1 = {
        "Authorization": "Bearer mock-member-token",
        "x-user-id": seeded_dashboard_data["member1"].id,
        "x-user-name": "Member 1",
        "x-user-role": "MEMBER",
        "x-user-email": "mem1.dash@t.dev",
    }
    p2_id = seeded_dashboard_data["p2"].id
    res_forbidden = await async_client.get(f"/task_management/api/v1/dashboard/stats?projectId={p2_id}", headers=headers_mem1)
    assert res_forbidden.status_code == 403
    assert "Forbidden" in res_forbidden.json()["message"]

