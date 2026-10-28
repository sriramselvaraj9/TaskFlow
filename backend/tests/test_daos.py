"""Integration tests for Data Access Objects (DAOs)."""

from datetime import date, datetime, timedelta, timezone
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.daos.activity_dao import activity_dao
from app.daos.column_dao import column_dao
from app.daos.project_dao import project_dao
from app.daos.task_dao import task_dao
from app.daos.token_dao import token_dao
from app.daos.user_dao import user_dao
from app.models.activity import ActivityAction
from app.models.column import BoardColumn
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority
from app.models.token import TokenType
from app.models.user import User, UserRole


@pytest.mark.asyncio
async def test_user_dao_crud(db_session: AsyncSession):
    """Verify user DAO create, get by email, get by IDs, and get all."""
    user = User(
        id="usr_101",
        name="Bob Builder",
        email="bob@builder.com",
        role=UserRole.MEMBER,
        designation="Architect",
    )
    await user_dao.create(db_session, user)

    # Fetch by ID
    fetched = await user_dao.get_by_id(db_session, "usr_101")
    assert fetched is not None
    assert fetched.name == "Bob Builder"

    # Fetch by email (case-insensitive)
    by_email = await user_dao.get_by_email(db_session, "BOB@BUILDER.COM")
    assert by_email is not None
    assert by_email.id == "usr_101"

    # Fetch by IDs
    users = await user_dao.get_by_ids(db_session, ["usr_101", "nonexistent"])
    assert len(users) == 1


@pytest.mark.asyncio
async def test_column_dao_ordering_and_reorder(db_session: AsyncSession):
    """Verify column ordering, max order query, and atomic reordering."""
    col1 = BoardColumn(id="BACKLOG", title="Backlog", order=0)
    col2 = BoardColumn(id="TODO", title="To Do", order=1)
    col3 = BoardColumn(id="DONE", title="Done", order=2)

    await column_dao.create(db_session, col1)
    await column_dao.create(db_session, col2)
    await column_dao.create(db_session, col3)

    cols = await column_dao.get_all_ordered(db_session)
    assert [c.id for c in cols] == ["BACKLOG", "TODO", "DONE"]

    max_order = await column_dao.get_max_order(db_session)
    assert max_order == 2

    # Reorder columns
    reordered = await column_dao.reorder(db_session, ["DONE", "TODO", "BACKLOG"])
    assert [c.id for c in reordered] == ["DONE", "TODO", "BACKLOG"]
    assert reordered[0].order == 0
    assert reordered[2].order == 2


@pytest.mark.asyncio
async def test_project_dao_with_members(db_session: AsyncSession):
    """Verify project creation, eager loading of members, and active count."""
    u1 = User(id="u_lead", name="Lead", email="lead@corp.com", role=UserRole.ADMIN)
    u2 = User(id="u_dev", name="Dev", email="dev@corp.com", role=UserRole.MEMBER)
    await user_dao.create(db_session, u1)
    await user_dao.create(db_session, u2)

    project = Project(
        id="prj_alpha",
        name="Alpha Service",
        key="ALP",
        description="Core Service",
        status=ProjectStatus.ACTIVE,
        owner_id="u_lead",
        members=[u1, u2],
    )
    await project_dao.create(db_session, project)

    fetched = await project_dao.get_by_id(db_session, "prj_alpha")
    assert fetched is not None
    assert len(fetched.members) == 2
    assert fetched.key == "ALP"

    # Check active count
    active_cnt = await project_dao.count_active(db_session)
    assert active_cnt == 1

    # Enroll user into all projects
    u3 = User(id="u_qa", name="QA", email="qa@corp.com", role=UserRole.MEMBER)
    await user_dao.create(db_session, u3)
    await project_dao.add_user_to_all_projects(db_session, u3)

    refetched = await project_dao.get_by_id(db_session, "prj_alpha")
    assert len(refetched.members) == 3


@pytest.mark.asyncio
async def test_task_dao_filters_and_aggregation(db_session: AsyncSession):
    """Verify task filtering, column migration, unassigning, and metrics calculation."""
    # Seed user, column, project
    user = User(id="u_worker", name="Worker", email="worker@corp.com", role=UserRole.MEMBER)
    await user_dao.create(db_session, user)

    col_backlog = BoardColumn(id="BACKLOG", title="Backlog", order=0)
    col_todo = BoardColumn(id="TODO", title="To Do", order=1)
    col_custom = BoardColumn(id="QA_TEST", title="QA Test", order=2)
    col_done = BoardColumn(id="DONE", title="Done", order=3)
    await column_dao.create(db_session, col_backlog)
    await column_dao.create(db_session, col_todo)
    await column_dao.create(db_session, col_custom)
    await column_dao.create(db_session, col_done)

    project = Project(
        id="prj_tasks",
        name="Task Project",
        key="TSK",
        description="Demo",
        status=ProjectStatus.ACTIVE,
        owner_id="u_worker",
    )
    await project_dao.create(db_session, project)

    # Create tasks
    t1 = Task(
        id="TSK-1",
        title="Fix Login Bug",
        description="Urgent auth issue",
        status="QA_TEST",
        priority=TaskPriority.HIGH,
        due_date=date.today() - timedelta(days=2),  # Overdue
        project_id="prj_tasks",
        assignee_id="u_worker",
        created_by_id="u_worker",
    )
    t2 = Task(
        id="TSK-2",
        title="Documentation",
        description="Write API guide",
        status="DONE",
        priority=TaskPriority.LOW,
        due_date=date.today() + timedelta(days=5),
        project_id="prj_tasks",
        assignee_id="u_worker",
        created_by_id="u_worker",
    )
    await task_dao.create(db_session, t1)
    await task_dao.create(db_session, t2)

    # 1. Filter by status
    qa_tasks = await task_dao.get_filtered(db_session, status="QA_TEST")
    assert len(qa_tasks) == 1
    assert qa_tasks[0].id == "TSK-1"

    # 2. Filter by search
    searched = await task_dao.get_filtered(db_session, search="login")
    assert len(searched) == 1
    assert searched[0].id == "TSK-1"

    # 3. Metrics aggregation
    (
        total_tasks,
        completed_tasks,
        in_progress_tasks,
        overdue_count,
        assigned_to_me,
        status_counts,
        priority_counts,
    ) = await task_dao.get_dashboard_metrics(db_session, user_id="u_worker")

    assert total_tasks == 2
    assert completed_tasks == 1
    assert overdue_count == 1  # TSK-1 is overdue and not DONE
    assert assigned_to_me == 1  # TSK-1 is assigned and not DONE

    # 4. Migrate column tasks
    moved = await task_dao.migrate_column_tasks(db_session, column_id="QA_TEST", new_status="BACKLOG")
    assert moved == 1

    t1_refetched = await task_dao.get_by_id(db_session, "TSK-1")
    assert t1_refetched.status == "BACKLOG"

    # 5. Unassign user tasks
    unassigned = await task_dao.unassign_user_tasks(db_session, user_id="u_worker", new_status="BACKLOG")
    assert unassigned >= 1
    assert t1_refetched.assignee_id is None


@pytest.mark.asyncio
async def test_token_and_activity_daos(db_session: AsyncSession):
    """Verify ephemeral token lifecycle and activity logging."""
    # Token creation & consumption
    now = datetime.now(timezone.utc)
    token = await token_dao.create_token(
        session=db_session,
        email="test@corp.com",
        token_type=TokenType.INVITE,
        token_hash="hash123",
        expires_at=now + timedelta(days=1),
    )
    assert token.id is not None

    valid_token = await token_dao.get_valid_token(
        session=db_session,
        email="test@corp.com",
        token_type=TokenType.INVITE,
        token_hash="hash123",
    )
    assert valid_token is not None

    await token_dao.consume_token(db_session, token.id)
    consumed_token = await token_dao.get_valid_token(
        session=db_session,
        email="test@corp.com",
        token_type=TokenType.INVITE,
        token_hash="hash123",
    )
    assert consumed_token is None

    # Activity log
    activity = await activity_dao.log_activity(
        session=db_session,
        action=ActivityAction.TASK_CREATED,
        details="Task created for testing",
        user_id="u1",
        user_name="User One",
        user_role="ADMIN",
    )
    assert activity.id is not None

    recent = await activity_dao.get_recent(db_session, limit=10)
    assert len(recent) >= 1
    assert recent[0].action == ActivityAction.TASK_CREATED
