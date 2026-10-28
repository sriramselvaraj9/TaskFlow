"""Unit tests for Pydantic v2 schemas and camelCase serialization."""

from datetime import date, datetime, timezone
import pytest
from pydantic import ValidationError

from app.schemas.column import ColumnCreate, ColumnReorder, ColumnResponse
from app.schemas.common import CamelModel, to_camel
from app.schemas.dashboard import DashboardStatsResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.schemas.task import TaskCreate, TaskFilterParams, TaskResponse, TaskUpdate
from app.schemas.user import ProvisionUserResponse, UserCreate, UserResponse


def test_to_camel_utility():
    """Verify snake_case to camelCase conversion."""
    assert to_camel("created_at") == "createdAt"
    assert to_camel("user_id") == "userId"
    assert to_camel("tasks_by_status") == "tasksByStatus"
    assert to_camel("name") == "name"


def test_user_schemas():
    """Verify User schema validation and alias generation."""
    create = UserCreate(
        name="Alice Engineer",
        email="alice@company.com",
        role="MEMBER",
        designation="Backend Dev",
    )
    assert create.name == "Alice Engineer"
    assert create.email == "alice@company.com"

    # CamelCase dump
    dumped = create.model_dump(by_alias=True)
    assert "designation" in dumped

    # Invalid email
    with pytest.raises(ValidationError):
        UserCreate(name="Bad User", email="not-an-email")


def test_task_date_validation():
    """Verify task start date cannot be after due date."""
    # Valid dates
    task_ok = TaskCreate(
        title="Valid Task",
        description="Testing dates",
        project_id="prj_1",
        start_date="2026-10-01",
        due_date="2026-10-15",
    )
    assert task_ok.title == "Valid Task"

    # Start date after due date raises error
    with pytest.raises(ValidationError) as exc:
        TaskCreate(
            title="Invalid Task",
            description="Testing invalid dates",
            project_id="prj_1",
            start_date="2026-10-20",
            due_date="2026-10-10",
        )
    assert "Start date cannot be after due date" in str(exc.value)


def test_column_reorder_schema():
    """Verify column reorder payload validation."""
    reorder = ColumnReorder(column_ids=["TODO", "IN_PROGRESS", "DONE"])
    dumped = reorder.model_dump(by_alias=True)
    assert "columnIds" in dumped
    assert dumped["columnIds"] == ["TODO", "IN_PROGRESS", "DONE"]

    # Empty column IDs
    with pytest.raises(ValidationError):
        ColumnReorder(column_ids=[])


def test_dashboard_stats_response():
    """Verify dashboard stats default values and serialization."""
    stats = DashboardStatsResponse(
        total_tasks=10,
        completed_tasks=5,
        in_progress_tasks=3,
        overdue_tasks=1,
        overdue_count=1,
        assigned_to_me=2,
        active_projects=2,
        completion_rate=50,
        tasks_by_status={"TODO": 2, "IN_PROGRESS": 3, "DONE": 5},
        tasks_by_priority={"LOW": 2, "MEDIUM": 5, "HIGH": 3},
    )
    dumped = stats.model_dump(by_alias=True)
    assert dumped["totalTasks"] == 10
    assert dumped["completionRate"] == 50
    assert dumped["tasksByStatus"]["DONE"] == 5
