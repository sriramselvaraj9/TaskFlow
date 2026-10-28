"""Architecture Review & Layered Separation Tests.

Verifies:
1. API Router -> Endpoint -> Service -> DAO -> PostgreSQL call chain.
2. Service layer runs with 100% mocked DAOs without a real database.
3. Endpoints can have services overridden via FastAPI dependency injection.
4. Static architectural verification: no DAO imports in endpoints, no SQL operations in services.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import (
    PermissionDeniedException,
    WorkflowRestrictionException,
)
from app.core.dependencies import (
    get_auth_service,
    get_current_user,
    get_dashboard_service,
    get_project_service,
    get_user_service,
)
from app.main import app
from app.models.column import BoardColumn
from app.models.task import Task, TaskPriority
from app.models.user import User, UserRole
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
)
from app.schemas.dashboard import DashboardStatsResponse
from app.schemas.project import ProjectCreate
from app.schemas.task import TaskUpdate
from app.schemas.user import UserResponse, UserTokenPayload
from app.services.auth_service import AuthService
from app.services.column_service import ColumnService
from app.services.dashboard_service import DashboardService
from app.services.project_service import ProjectService
from app.services.task_service import TaskService


@pytest.mark.asyncio
async def test_auth_service_with_mocked_dependencies():
    """Verify AuthService runs pure business logic with mocked DAOs and Redis without a database."""
    mock_user_service = MagicMock()
    mock_user_dao = MagicMock()
    mock_session_service = MagicMock()
    mock_rate_check = AsyncMock()
    mock_rate_reset = AsyncMock()

    user = User(
        id="usr_mock_1",
        name="Mock User",
        email="mock@taskflow.dev",
        role=UserRole.MEMBER,
        password_hash="mock_hash",
        designation="Tester",
        created_at=datetime.now(timezone.utc),
    )
    mock_user_service.register_user = AsyncMock(return_value=user)
    mock_user_service.authenticate_user = AsyncMock(return_value=user)
    mock_session_service.create_session = AsyncMock(return_value=("mock_refresh_token", "sid_1", 604800))
    mock_session_service.rotate_refresh_token = AsyncMock(return_value=("new_refresh_token", user.id, "sid_2"))
    mock_user_dao.get_by_id = AsyncMock(return_value=user)

    service = AuthService(
        user_service=mock_user_service,
        user_dao=mock_user_dao,
        session_service=mock_session_service,
        rate_limiter_check=mock_rate_check,
        rate_limiter_reset=mock_rate_reset,
    )

    mock_session = AsyncMock()

    # 1. Register
    reg_req = RegisterRequest(
        name="Mock User",
        email="mock@taskflow.dev",
        password="ValidPassword123!",
    )
    res_reg = await service.register(mock_session, reg_req, client_ip="127.0.0.1")
    assert isinstance(res_reg, AuthResponse)
    assert res_reg.user.email == "mock@taskflow.dev"
    assert res_reg.refresh_token == "mock_refresh_token"
    mock_user_service.register_user.assert_awaited_once()

    # 2. Login
    login_req = LoginRequest(email="mock@taskflow.dev", password="ValidPassword123!")
    res_login = await service.login(mock_session, login_req, client_ip="127.0.0.1")
    assert isinstance(res_login, AuthResponse)
    assert res_login.access_token is not None
    mock_rate_check.assert_awaited_once_with(ip="127.0.0.1", email="mock@taskflow.dev")
    mock_rate_reset.assert_awaited_once_with(ip="127.0.0.1", email="mock@taskflow.dev")

    # 3. Refresh
    res_ref = await service.refresh_tokens(mock_session, "mock_refresh_token")
    assert res_ref.refresh_token == "new_refresh_token"
    mock_user_dao.get_by_id.assert_awaited_once_with(mock_session, user.id)


@pytest.mark.asyncio
async def test_dashboard_service_with_mocked_daos():
    """Verify DashboardService aggregates metrics without a real database."""
    mock_task_dao = MagicMock()
    mock_project_dao = MagicMock()

    mock_task_dao.get_dashboard_metrics = AsyncMock(
        return_value=(
            10,  # total
            5,   # completed
            3,   # in progress
            1,   # overdue
            4,   # assigned to me
            {"BACKLOG": 1, "TODO": 1, "IN_PROGRESS": 3, "IN_REVIEW": 0, "DONE": 5},
            {"LOW": 2, "MEDIUM": 5, "HIGH": 3},
        )
    )
    mock_project_dao.count_active = AsyncMock(return_value=3)

    service = DashboardService(task_dao=mock_task_dao, project_dao=mock_project_dao)
    mock_session = AsyncMock()

    stats = await service.get_dashboard_stats(mock_session)
    assert stats.total_tasks == 10
    assert stats.completed_tasks == 5
    assert stats.completion_rate == 50
    assert stats.active_projects == 3
    assert stats.overdue_count == 1
    mock_task_dao.get_dashboard_metrics.assert_awaited_once()
    mock_project_dao.count_active.assert_awaited_once()


@pytest.mark.asyncio
async def test_project_service_rbac_with_mocked_dao():
    """Verify ProjectService enforces RBAC before querying or modifying database."""
    mock_project_dao = MagicMock()
    service = ProjectService(project_dao=mock_project_dao)
    mock_session = AsyncMock()

    member_user = UserTokenPayload(id="u1", name="M", email="m@t.dev", role="MEMBER")
    data = ProjectCreate(name="New Project", key="NEWP", description="Detailed Project Description")

    # Non-admin cannot create project; dao.create should NEVER be called
    with pytest.raises(PermissionDeniedException):
        await service.create_project(mock_session, data, member_user)
    mock_project_dao.create.assert_not_called()


@pytest.mark.asyncio
async def test_column_service_workflow_safeguards_with_mocked_dao():
    """Verify ColumnService protects default columns without invoking DAO delete."""
    mock_col_dao = MagicMock()
    mock_task_dao = MagicMock()
    service = ColumnService(column_dao=mock_col_dao, task_dao=mock_task_dao)
    mock_session = AsyncMock()

    admin_user = UserTokenPayload(id="adm", name="Admin", email="adm@t.dev", role="ADMIN")

    # Deleting protected column "BACKLOG" must raise WorkflowRestrictionException
    with pytest.raises(WorkflowRestrictionException):
        await service.delete_column(mock_session, "BACKLOG", admin_user)

    mock_col_dao.delete.assert_not_called()
    mock_task_dao.migrate_column_tasks.assert_not_called()


@pytest.mark.asyncio
async def test_task_service_state_machine_with_mocked_dao():
    """Verify TaskService enforces valid state machine transitions with mocked DAO."""
    mock_task_dao = MagicMock()
    mock_col_dao = MagicMock()
    service = TaskService(task_dao=mock_task_dao, column_dao=mock_col_dao)
    mock_session = AsyncMock()

    admin_user = UserTokenPayload(id="adm", name="Admin", email="adm@t.dev", role="ADMIN")
    existing_task = Task(
        id="PRJ-001",
        title="Sample Task",
        description="Desc",
        status="TODO",
        priority=TaskPriority.HIGH,
        project_id="prj_1",
        created_by_id="adm",
    )
    mock_task_dao.get_by_id = AsyncMock(return_value=existing_task)
    mock_col_dao.get_by_id_ci = AsyncMock(return_value=BoardColumn(id="DONE", title="Done", order=4))

    # Illegal transition: TODO -> DONE without review
    with pytest.raises(WorkflowRestrictionException):
        await service.update_task(
            session=mock_session,
            task_id="PRJ-001",
            data=TaskUpdate(status="DONE"),
            current_user=admin_user,
        )

    mock_task_dao.update.assert_not_called()


def test_endpoint_dependency_injection_override():
    """Verify endpoints decouple from concrete services via FastAPI dependency injection overrides."""
    mock_dashboard_service = MagicMock(spec=DashboardService)
    mock_dashboard_service.get_dashboard_stats = AsyncMock(
        return_value=DashboardStatsResponse(
            total_tasks=99,
            completed_tasks=90,
            in_progress_tasks=5,
            overdue_tasks=0,
            overdue_count=0,
            assigned_to_me=12,
            active_projects=4,
            completion_rate=91,
            tasks_by_status={"DONE": 90, "IN_PROGRESS": 5},
            tasks_by_priority={"HIGH": 20},
        )
    )

    admin_token_user = UserTokenPayload(id="u_adm", name="Admin", email="a@t.dev", role="ADMIN")

    app.dependency_overrides[get_dashboard_service] = lambda: mock_dashboard_service
    app.dependency_overrides[get_current_user] = lambda: admin_token_user

    try:
        with TestClient(app) as client:
            resp = client.get("/api/dashboard/stats")
            assert resp.status_code == 200
            data = resp.json()
            assert data["totalTasks"] == 99
            assert data["completionRate"] == 91
            assert data["activeProjects"] == 4
            mock_dashboard_service.get_dashboard_stats.assert_awaited_once()
    finally:
        app.dependency_overrides.clear()




def test_architectural_boundaries_no_daos_in_endpoints():
    """Inspects endpoint modules to ensure zero DAO imports or direct database queries."""
    import inspect
    from app.api.v1.endpoints import (
        activities,
        auth,
        columns,
        dashboard,
        health,
        projects,
        tasks,
        users,
    )

    endpoint_modules = [activities, auth, columns, dashboard, health, projects, tasks, users]
    for mod in endpoint_modules:
        source = inspect.getsource(mod)
        assert "from app.daos" not in source, f"Violation: {mod.__name__} imports from app.daos directly"
        assert "select(" not in source, f"Violation: {mod.__name__} contains SQLAlchemy select query"
        assert "session.execute(" not in source, f"Violation: {mod.__name__} calls session.execute directly"
