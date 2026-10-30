"""Domain CRUD, pagination, filtering, sorting, conflicts, and transaction rollback tests."""

from datetime import date, datetime, timedelta, timezone
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.exceptions import ConflictException, NotFoundException
from app.daos.column_dao import column_dao
from app.daos.project_dao import project_dao
from app.daos.task_dao import task_dao
from app.daos.user_dao import user_dao
from app.models.column import BoardColumn
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority
from app.models.user import User, UserRole
from app.schemas.column import ColumnCreate
from app.schemas.project import ProjectCreate
from app.schemas.task import TaskCreate, TaskFilterParams
from app.schemas.user import UserCreate, UserTokenPayload
from app.services.column_service import column_service
from app.services.project_service import project_service
from app.services.task_service import task_service
from app.services.user_service import user_service

ADMIN = UserTokenPayload(id="u_admin_crud", name="Admin", email="admin.crud@t.dev", role="ADMIN")
MEMBER = UserTokenPayload(id="u_mem_crud", name="Member", email="mem.crud@t.dev", role="MEMBER")


@pytest.fixture
async def crud_seeded_env(db_session: AsyncSession):
    """Sets up base users, columns, and an active project for CRUD testing."""
    admin_user = User(id=ADMIN.id, name=ADMIN.name, email=ADMIN.email, role=UserRole.ADMIN)
    member_user = User(id=MEMBER.id, name=MEMBER.name, email=MEMBER.email, role=UserRole.MEMBER)
    await user_dao.create(db_session, admin_user)
    await user_dao.create(db_session, member_user)

    for cid, title, order in [
        ("TODO", "To Do", 0),
        ("IN_PROGRESS", "In Progress", 1),
        ("DONE", "Done", 2),
    ]:
        await column_dao.create(db_session, BoardColumn(id=cid, title=title, order=order))

    proj = Project(
        id="p_crud_main",
        name="Main CRUD Project",
        key="CRD",
        description="Testing CRUD queries",
        status=ProjectStatus.ACTIVE,
        owner_id=admin_user.id,
        members=[admin_user, member_user],
    )
    await project_dao.create(db_session, proj)
    await db_session.commit()
    return {"admin": admin_user, "member": member_user, "project": proj}


# ============================================================================
# 1. Task Pagination & Multi-Criteria Filtering
# ============================================================================

@pytest.mark.asyncio
async def test_task_pagination_limit_and_offset(db_session: AsyncSession, crud_seeded_env):
    """Verify tasks query respects limit and offset pagination without overlapping across pages."""
    proj = crud_seeded_env["project"]
    admin = crud_seeded_env["admin"]

    # Seed 12 tasks with staggered timestamps
    now = datetime.now(timezone.utc)
    for i in range(12):
        t = Task(
            id=f"CRD-PAG-{i:02d}",
            title=f"Pagination Task {i}",
            description="Pagination Description",
            status="TODO",
            priority=TaskPriority.MEDIUM,
            project_id=proj.id,
            created_by_id=admin.id,
            due_date=date.today() + timedelta(days=5),
            created_at=now + timedelta(seconds=i),
            updated_at=now + timedelta(seconds=i),
        )
        await task_dao.create(db_session, t)
    await db_session.commit()

    # Page 1: limit 5, offset 0
    p1_params = TaskFilterParams(project_id=proj.id, limit=5, offset=0)
    page1 = await task_service.get_tasks(db_session, p1_params, ADMIN)
    assert len(page1) == 5

    # Page 2: limit 5, offset 5
    p2_params = TaskFilterParams(project_id=proj.id, limit=5, offset=5)
    page2 = await task_service.get_tasks(db_session, p2_params, ADMIN)
    assert len(page2) == 5

    # Page 3: limit 5, offset 10 (remaining 2)
    p3_params = TaskFilterParams(project_id=proj.id, limit=5, offset=10)
    page3 = await task_service.get_tasks(db_session, p3_params, ADMIN)
    assert len(page3) == 2

    # Verify no duplicate task IDs between Page 1 and Page 2
    p1_ids = {t.id for t in page1}
    p2_ids = {t.id for t in page2}
    assert p1_ids.isdisjoint(p2_ids)


@pytest.mark.asyncio
async def test_task_multi_criteria_filtering_and_search(db_session: AsyncSession, crud_seeded_env):
    """Verify combined filtering by status, priority, assignee, and case-insensitive search text."""
    proj = crud_seeded_env["project"]
    admin = crud_seeded_env["admin"]
    member = crud_seeded_env["member"]

    # Task A: High priority, IN_PROGRESS, assigned to member, has keyword "security"
    t_a = Task(
        id="CRD-FLT-A",
        title="Implement Security Headers",
        description="Audit CSP and HSTS headers",
        status="IN_PROGRESS",
        priority=TaskPriority.HIGH,
        project_id=proj.id,
        assignee_id=member.id,
        created_by_id=admin.id,
        due_date=date.today() + timedelta(days=3),
    )
    # Task B: Low priority, TODO, assigned to admin, has keyword "security"
    t_b = Task(
        id="CRD-FLT-B",
        title="Review Security Guidelines",
        description="Docs review",
        status="TODO",
        priority=TaskPriority.LOW,
        project_id=proj.id,
        assignee_id=admin.id,
        created_by_id=admin.id,
        due_date=date.today() + timedelta(days=3),
    )
    await task_dao.create(db_session, t_a)
    await task_dao.create(db_session, t_b)
    await db_session.commit()

    # Filter with status=IN_PROGRESS and search="security"
    res1 = await task_dao.get_filtered(
        db_session,
        project_id=proj.id,
        status="IN_PROGRESS",
        search="security",
    )
    assert len(res1) == 1
    assert res1[0].id == "CRD-FLT-A"

    # Filter by assignee=member
    res2 = await task_dao.get_filtered(
        db_session,
        project_id=proj.id,
        assignee_id=member.id,
    )
    assert any(t.id == "CRD-FLT-A" for t in res2)
    assert all(t.id != "CRD-FLT-B" for t in res2)


# ============================================================================
# 2. Sorting Invariance
# ============================================================================

@pytest.mark.asyncio
async def test_sorting_order_across_tasks_columns_and_projects(db_session: AsyncSession, crud_seeded_env):
    """Verify tasks are sorted by updated_at DESC, columns by order ASC, and projects by created_at DESC."""
    # 1. Column sorting: order ASC
    cols = await column_dao.get_all_ordered(db_session)
    orders = [c.order for c in cols]
    assert orders == sorted(orders)

    # 2. Task sorting: updated_at DESC
    proj = crud_seeded_env["project"]
    tasks = await task_dao.get_filtered(db_session, project_id=proj.id)
    if len(tasks) >= 2:
        for idx in range(len(tasks) - 1):
            assert tasks[idx].updated_at >= tasks[idx + 1].updated_at

    # 3. Project sorting: created_at DESC
    projects = await project_dao.get_all(db_session)
    if len(projects) >= 2:
        for idx in range(len(projects) - 1):
            assert projects[idx].created_at >= projects[idx + 1].created_at


# ============================================================================
# 3. Validation Rules & Constraint Violations
# ============================================================================

@pytest.mark.asyncio
async def test_task_create_validation_safeguards(db_session: AsyncSession, crud_seeded_env):
    """Verify business logic and date validations reject invalid payloads."""
    proj = crud_seeded_env["project"]

    # 1. Start date cannot be after due date
    with pytest.raises(ValueError) as exc:
        TaskCreate(
            title="Invalid Date Task",
            description="Testing dates",
            project_id=proj.id,
            start_date="2026-12-31",
            due_date="2026-01-01",
        )
    assert "Start date cannot be after due date" in str(exc.value)

    # 2. Target project does not exist
    valid_payload = TaskCreate(
        title="Valid Task Title",
        description="Valid description",
        project_id="non_existent_proj_999",
        due_date="2026-12-31",
    )
    with pytest.raises(NotFoundException):
        await task_service.create_task(db_session, valid_payload, ADMIN)


# ============================================================================
# 4. Uniqueness Conflicts
# ============================================================================

@pytest.mark.asyncio
async def test_uniqueness_conflicts_prevent_duplicates(db_session: AsyncSession, crud_seeded_env):
    """Verify duplicate user email, project key, and column titles raise ConflictException."""
    # 1. Duplicate user email
    with pytest.raises(ConflictException):
        await user_service.provision_user(
            db_session,
            UserCreate(name="Duplicate Admin", email=ADMIN.email, role="ADMIN"),
            ADMIN,
        )

    # 2. Duplicate project key
    with pytest.raises(ConflictException):
        await project_service.create_project(
            db_session,
            ProjectCreate(name="New Project Duplicate Key", key="CRD", description="Detailed project description"),
            ADMIN,
        )

    # 3. Duplicate column title
    with pytest.raises(ConflictException):
        await column_service.create_column(
            db_session,
            ColumnCreate(title="To Do"),  # already exists
            ADMIN,
        )


# ============================================================================
# 5. Transaction Rollback Integrity
# ============================================================================

@pytest.mark.asyncio
async def test_transaction_rollback_prevents_partial_writes(db_session: AsyncSession):
    """Verify failed transactions roll back and leave zero orphaned records in the database."""
    test_user_id = f"u_rollback_{uuid.uuid4().hex[:6]}"
    u = User(id=test_user_id, name="Rollback Candidate", email="rollback@t.dev", role=UserRole.MEMBER)

    try:
        db_session.add(u)
        await db_session.flush()

        # Simulate unexpected failure mid-transaction
        raise RuntimeError("Forced transaction failure before commit")
    except RuntimeError:
        await db_session.rollback()

    # Verify user does not exist in database after rollback
    stmt = select(User).where(User.id == test_user_id)
    result = await db_session.execute(stmt)
    assert result.scalar_one_or_none() is None
