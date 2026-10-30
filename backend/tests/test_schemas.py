"""Unit tests for Pydantic v2 schemas and camelCase serialization."""

import pytest
from pydantic import ValidationError

from app.schemas.column import ColumnReorder
from app.schemas.common import to_camel
from app.schemas.dashboard import DashboardStatsResponse
from app.schemas.project import ProjectCreate
from app.schemas.task import TaskCreate
from app.schemas.user import UserCreate


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


def test_project_optional_description():
    """Verify project creation allows empty or omitted description."""
    # Omitted description
    proj_no_desc = ProjectCreate(name="Frontend App")
    assert proj_no_desc.name == "Frontend App"
    assert proj_no_desc.description == ""

    # Explicit empty string description
    proj_empty_desc = ProjectCreate(name="Frontend App", description="")
    assert proj_empty_desc.description == ""

    # Provided description
    proj_with_desc = ProjectCreate(name="Frontend App", description="Core web application")
    assert proj_with_desc.description == "Core web application"


def test_task_optional_description():
    """Verify task creation allows empty or omitted description."""
    # Omitted description
    task_no_desc = TaskCreate(
        title="Implement Auth",
        project_id="prj_1",
        due_date="2026-11-15",
    )
    assert task_no_desc.title == "Implement Auth"
    assert task_no_desc.description == ""

    # Explicit empty string description
    task_empty_desc = TaskCreate(
        title="Implement Auth",
        description="",
        project_id="prj_1",
        due_date="2026-11-15",
    )
    assert task_empty_desc.description == ""


