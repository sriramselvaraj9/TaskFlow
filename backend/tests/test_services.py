"""Unit and integration tests for Business Services."""

from datetime import date, timedelta
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
    ValidationException,
    WorkflowRestrictionException,
)
from app.daos.column_dao import column_dao
from app.daos.project_dao import project_dao
from app.daos.task_dao import task_dao
from app.daos.user_dao import user_dao
from app.models.column import BoardColumn
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskPriority
from app.models.user import User, UserRole
from app.schemas.column import ColumnCreate
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.schemas.task import TaskCreate, TaskFilterParams, TaskUpdate
from app.schemas.user import UserCreate, UserTokenPayload
from app.services.column_service import column_service
from app.services.project_service import project_service
from app.services.task_service import task_service
from app.services.user_service import user_service

ADMIN_USER = UserTokenPayload(
    id="admin_001",
    name="Admin User",
    email="admin@taskflow.dev",
    role="ADMIN",
    designation="Tech Lead",
)

MEMBER_USER = UserTokenPayload(
    id="member_001",
    name="Member User",
    email="member@taskflow.dev",
    role="MEMBER",
    designation="Developer",
)


@pytest.mark.asyncio
async def test_column_service_workflow_rules(db_session: AsyncSession):
    """Verify column creation, conflict detection, and protection of default columns."""
    # Seed default columns
    c_todo = BoardColumn(id="TODO", title="To Do", order=0)
    c_done = BoardColumn(id="DONE", title="Done", order=1)
    await column_dao.create(db_session, c_todo)
    await column_dao.create(db_session, c_done)

    # 1. Create custom column
    custom = await column_service.create_column(
        db_session,
        ColumnCreate(title="Testing & QA"),
        ADMIN_USER,
    )
    assert custom.id == "TESTING_QA"
    assert custom.order == 2

    # 2. Duplicate column title raises conflict
    with pytest.raises(ConflictException):
        await column_service.create_column(
            db_session,
            ColumnCreate(title="Testing & QA"),
            ADMIN_USER,
        )

    # 3. Attempting to delete protected system column raises WorkflowRestrictionException
    with pytest.raises(WorkflowRestrictionException):
        await column_service.delete_column(db_session, "TODO", ADMIN_USER)

    # 4. Deleting custom column succeeds
    del_col, moved = await column_service.delete_column(db_session, "TESTING_QA", ADMIN_USER)
    assert del_col.id == "TESTING_QA"


@pytest.mark.asyncio
async def test_task_workflow_state_machine(db_session: AsyncSession):
    """Verify sequential status transitions and prevention of illegal state jumps."""
    # Seed required entities
    admin = User(id=ADMIN_USER.id, name=ADMIN_USER.name, email=ADMIN_USER.email, role=UserRole.ADMIN)
    await user_dao.create(db_session, admin)

    for cid, title, order in [
        ("BACKLOG", "Backlog", 0),
        ("TODO", "To Do", 1),
        ("IN_PROGRESS", "In Progress", 2),
        ("IN_REVIEW", "In Review", 3),
        ("DONE", "Done", 4),
    ]:
        await column_dao.create(db_session, BoardColumn(id=cid, title=title, order=order))

    project = Project(
        id="prj_workflow",
        name="Workflow Test",
        key="WFL",
        description="Testing state transitions",
        status=ProjectStatus.ACTIVE,
        owner_id=admin.id,
    )
    await project_dao.create(db_session, project)

    # Create task in TODO
    task = await task_service.create_task(
        db_session,
        TaskCreate(
            title="Follow State Rules",
            description="Testing state machine",
            project_id=project.id,
            status="TODO",
            priority="HIGH",
            due_date=str(date.today() + timedelta(days=7)),
        ),
        ADMIN_USER,
    )
    assert task.status == "TODO"

    # ILLEGAL: TODO -> DONE
    with pytest.raises(WorkflowRestrictionException):
        await task_service.update_task(
            db_session,
            task.id,
            TaskUpdate(status="DONE"),
            ADMIN_USER,
        )

    # ILLEGAL: TODO -> IN_REVIEW
    with pytest.raises(WorkflowRestrictionException):
        await task_service.update_task(
            db_session,
            task.id,
            TaskUpdate(status="IN_REVIEW"),
            ADMIN_USER,
        )

    # LEGAL: TODO -> IN_PROGRESS
    t_progress = await task_service.update_task(
        db_session,
        task.id,
        TaskUpdate(status="IN_PROGRESS"),
        ADMIN_USER,
    )
    assert t_progress.status == "IN_PROGRESS"

    # ILLEGAL: IN_PROGRESS -> DONE (must go through IN_REVIEW)
    with pytest.raises(WorkflowRestrictionException):
        await task_service.update_task(
            db_session,
            task.id,
            TaskUpdate(status="DONE"),
            ADMIN_USER,
        )

    # LEGAL: IN_PROGRESS -> IN_REVIEW
    t_review = await task_service.update_task(
        db_session,
        task.id,
        TaskUpdate(status="IN_REVIEW"),
        ADMIN_USER,
    )
    assert t_review.status == "IN_REVIEW"

    # LEGAL: IN_REVIEW -> DONE
    t_done = await task_service.update_task(
        db_session,
        task.id,
        TaskUpdate(status="DONE"),
        ADMIN_USER,
    )
    assert t_done.status == "DONE"


@pytest.mark.asyncio
async def test_user_service_lifecycle_and_safeguards(db_session: AsyncSession):
    """Verify user provisioning, auto-project assignment, and self-deletion restriction."""
    # Seed an admin and a project
    admin = User(id=ADMIN_USER.id, name=ADMIN_USER.name, email=ADMIN_USER.email, role=UserRole.ADMIN)
    await user_dao.create(db_session, admin)

    project = Project(
        id="prj_company",
        name="Company Board",
        key="CMP",
        description="Main workspace",
        status=ProjectStatus.ACTIVE,
        owner_id=admin.id,
        members=[admin],
    )
    await project_dao.create(db_session, project)

    # 1. Provision new user
    provision_res = await user_service.provision_user(
        db_session,
        UserCreate(name="New Joiner", email="joiner@corp.com", role="MEMBER", designation="Intern"),
        ADMIN_USER,
    )
    assert provision_res.user.name == "New Joiner"
    assert "token=" in provision_res.invite_url

    # Check auto-enrollment into project
    refetched_proj = await project_dao.get_by_id(db_session, project.id)
    assert len(refetched_proj.members) == 2

    # 2. Prevent self-deletion
    with pytest.raises(WorkflowRestrictionException):
        await user_service.delete_user(db_session, ADMIN_USER.id, ADMIN_USER)

    # 3. Offboard member: succeeds
    deleted_member = await user_service.delete_user(db_session, provision_res.user.id, ADMIN_USER)
    assert deleted_member.id == provision_res.user.id


@pytest.mark.asyncio
async def test_project_service_edge_cases(db_session: AsyncSession):
    """Verify ProjectService validation and missing resource errors."""
    admin = User(id=ADMIN_USER.id, name=ADMIN_USER.name, email=ADMIN_USER.email, role=UserRole.ADMIN)
    await user_dao.create(db_session, admin)

    # 1. Create project with explicit key
    p = await project_service.create_project(
        db_session,
        ProjectCreate(name="Explicit Key", key="EXP", description="Description here"),
        ADMIN_USER,
    )
    assert p.key == "EXP"

    # 2. Duplicate key error
    with pytest.raises(ConflictException):
        await project_service.create_project(
            db_session,
            ProjectCreate(name="Duplicate Key", key="EXP", description="Another description"),
            ADMIN_USER,
        )

    # 3. Get non-existent project raises NotFoundException
    with pytest.raises(NotFoundException):
        await project_service.get_project(db_session, "non_existent_id")

    # 4. Update non-existent project raises NotFoundException
    with pytest.raises(NotFoundException):
        await project_service.update_project(
            db_session,
            "non_existent_id",
            ProjectUpdate(name="New Name"),
            ADMIN_USER,
        )

    # 5. Delete non-existent project raises NotFoundException
    with pytest.raises(NotFoundException):
        await project_service.delete_project(db_session, "non_existent_id", ADMIN_USER)


@pytest.mark.asyncio
async def test_task_service_validation_errors(db_session: AsyncSession):
    """Verify TaskService relationship validations and missing entity handling."""
    admin = User(id=ADMIN_USER.id, name=ADMIN_USER.name, email=ADMIN_USER.email, role=UserRole.ADMIN)
    await user_dao.create(db_session, admin)

    c_todo = BoardColumn(id="TODO", title="To Do", order=0)
    await column_dao.create(db_session, c_todo)

    proj = Project(
        id="prj_valid",
        name="Valid Proj",
        key="VAL",
        description="Testing validations",
        status=ProjectStatus.ACTIVE,
        owner_id=admin.id,
    )
    await project_dao.create(db_session, proj)

    # 1. Non-existent project
    with pytest.raises(NotFoundException):
        await task_service.create_task(
            db_session,
            TaskCreate(
                title="Task",
                description="Desc",
                project_id="missing_prj",
                status="TODO",
                due_date=str(date.today()),
            ),
            ADMIN_USER,
        )

    # 2. Non-existent assignee
    with pytest.raises(NotFoundException):
        await task_service.create_task(
            db_session,
            TaskCreate(
                title="Task",
                description="Desc",
                project_id=proj.id,
                assignee_id="missing_user",
                status="TODO",
                due_date=str(date.today()),
            ),
            ADMIN_USER,
        )

    # 3. Non-existent workflow column
    with pytest.raises(ValidationException):
        await task_service.create_task(
            db_session,
            TaskCreate(
                title="Task",
                description="Desc",
                project_id=proj.id,
                status="NON_EXISTENT_STATUS",
                due_date=str(date.today()),
            ),
            ADMIN_USER,
        )

    # 4. Get non-existent task
    with pytest.raises(NotFoundException):
        await task_service.get_task(db_session, "missing_task_id")

    # 5. Delete non-existent task
    with pytest.raises(NotFoundException):
        await task_service.delete_task(db_session, "missing_task_id", ADMIN_USER)

