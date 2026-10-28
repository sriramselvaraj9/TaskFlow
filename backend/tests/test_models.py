"""Unit tests for SQLAlchemy ORM models, constraints, and relationships."""

from datetime import date
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityAction, ActivityLog
from app.models.column import BoardColumn
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority
from app.models.token import TokenType, UserToken
from app.models.user import User, UserRole


@pytest.mark.asyncio
async def test_user_creation_and_role(db_session: AsyncSession):
    """Verify User creation, role validation, and default timestamps."""
    user = User(
        id="user-test-1",
        name="Test Engineer",
        email="test.engineer@company.com",
        role=UserRole.MEMBER,
        designation="Software Engineer",
    )
    db_session.add(user)
    await db_session.commit()

    stmt = select(User).where(User.id == "user-test-1")
    result = await db_session.execute(stmt)
    saved_user = result.scalar_one()

    assert saved_user.name == "Test Engineer"
    assert saved_user.email == "test.engineer@company.com"
    assert saved_user.role == UserRole.MEMBER
    assert saved_user.created_at is not None


@pytest.mark.asyncio
async def test_project_and_membership_relationship(db_session: AsyncSession):
    """Verify Project creation, ownership, and many-to-many members association."""
    owner = User(
        id="user-owner-1",
        name="Lead Admin",
        email="owner@company.com",
        role=UserRole.ADMIN,
    )
    member = User(
        id="user-member-1",
        name="Dev Member",
        email="member@company.com",
        role=UserRole.MEMBER,
    )
    db_session.add_all([owner, member])
    await db_session.commit()

    project = Project(
        id="prj-test-1",
        name="Core Infrastructure",
        key="CORE",
        description="Core platform backend infrastructure.",
        status=ProjectStatus.ACTIVE,
        owner_id=owner.id,
    )
    project.members.append(owner)
    project.members.append(member)
    db_session.add(project)
    await db_session.commit()

    stmt = select(Project).where(Project.id == "prj-test-1")
    result = await db_session.execute(stmt)
    saved_project = result.scalar_one()

    assert saved_project.key == "CORE"
    assert saved_project.owner_id == owner.id
    assert len(saved_project.members) == 2


@pytest.mark.asyncio
async def test_task_creation_and_constraints(db_session: AsyncSession):
    """Verify Task entity persistence, foreign keys, and tags serialization."""
    user = User(
        id="user-creator-1",
        name="Creator",
        email="creator@company.com",
        role=UserRole.ADMIN,
    )
    project = Project(
        id="prj-test-task",
        name="Task Project",
        key="TSK",
        description="Testing task functionality.",
        status=ProjectStatus.ACTIVE,
        owner_id=user.id,
    )
    db_session.add_all([user, project])
    await db_session.commit()

    task = Task(
        id="task-test-1",
        title="Implement Phase C",
        description="Implement foundational architecture and schema.",
        project_id=project.id,
        status="TODO",
        priority=TaskPriority.HIGH,
        created_by_id=user.id,
        due_date=date(2026, 10, 30),
        tags=["foundation", "fastapi"],
    )
    db_session.add(task)
    await db_session.commit()

    stmt = select(Task).where(Task.id == "task-test-1")
    result = await db_session.execute(stmt)
    saved_task = result.scalar_one()

    assert saved_task.title == "Implement Phase C"
    assert saved_task.priority == TaskPriority.HIGH
    assert saved_task.tags == ["foundation", "fastapi"]
    assert saved_task.due_date == date(2026, 10, 30)


@pytest.mark.asyncio
async def test_board_column_ordering(db_session: AsyncSession):
    """Verify BoardColumn order indexing and persistence."""
    cols = [
        BoardColumn(id="DONE", title="Done", order=3),
        BoardColumn(id="TODO", title="To Do", order=0),
        BoardColumn(id="IN_PROGRESS", title="In Progress", order=1),
    ]
    db_session.add_all(cols)
    await db_session.commit()

    stmt = select(BoardColumn).order_by(BoardColumn.order.asc())
    result = await db_session.execute(stmt)
    ordered_cols = result.scalars().all()

    assert [c.id for c in ordered_cols] == ["TODO", "IN_PROGRESS", "DONE"]
