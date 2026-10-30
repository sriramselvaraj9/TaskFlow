"""Task workflow, filtering, and dashboard business service."""

from datetime import date
from typing import Any, List, Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheService, cache_service as default_cache_service
from app.core.config import settings
from app.core.exceptions import (
    NotFoundException,
    PermissionDeniedException,
    ValidationException,
    WorkflowRestrictionException,
)
from app.daos.column_dao import ColumnDAO, column_dao as default_column_dao
from app.daos.project_dao import ProjectDAO, project_dao as default_project_dao
from app.daos.task_dao import TaskDAO, task_dao as default_task_dao
from app.daos.user_dao import UserDAO, user_dao as default_user_dao
from app.models.activity import ActivityAction
from app.models.task import Task, TaskPriority
from app.schemas.dashboard import DashboardStatsResponse
from app.schemas.task import TaskCreate, TaskFilterParams, TaskResponse, TaskUpdate
from app.schemas.user import UserTokenPayload
from app.services.activity_service import ActivityService, activity_service as default_activity_service

ILLEGAL_TRANSITIONS = {
    ("TODO", "DONE"),
    ("TODO", "IN_REVIEW"),
    ("IN_PROGRESS", "DONE"),
    ("BACKLOG", "DONE"),
    ("BACKLOG", "IN_REVIEW"),
}


class TaskService:
    """Business operations for Tasks, workflow progression, and metrics."""

    def __init__(
        self,
        task_dao: Optional[TaskDAO] = None,
        project_dao: Optional[ProjectDAO] = None,
        user_dao: Optional[UserDAO] = None,
        column_dao: Optional[ColumnDAO] = None,
        activity_service: Optional[ActivityService] = None,
        dashboard_service: Optional[Any] = None,
        cache_service: Optional[CacheService] = None,
    ) -> None:
        self.task_dao = task_dao or default_task_dao
        self.project_dao = project_dao or default_project_dao
        self.user_dao = user_dao or default_user_dao
        self.column_dao = column_dao or default_column_dao
        self.activity_service = activity_service or default_activity_service
        self._dashboard_service = dashboard_service
        self.cache_service = cache_service or default_cache_service

    @property
    def dashboard_service(self):
        if self._dashboard_service is None:
            from app.services.dashboard_service import dashboard_service
            self._dashboard_service = dashboard_service
        return self._dashboard_service

    async def get_tasks(
        self,
        session: AsyncSession,
        params: TaskFilterParams,
        current_user: Optional[UserTokenPayload] = None,
    ) -> List[Any]:
        """Fetch tasks matching criteria with cache-aside."""
        cache_key = self.cache_service.tasks_list_key(
            user_id=current_user.id if current_user else None,
            role=current_user.role if current_user else None,
            project_id=params.project_id,
            status=params.status,
            priority=params.priority,
            assignee_id=params.assignee_id,
            search=params.search,
            limit=params.limit,
            offset=params.offset,
        )
        cached = await self.cache_service.get(cache_key)
        if cached is not None:
            return cached

        tasks = await self.task_dao.get_filtered(
            session=session,
            project_id=params.project_id,
            status=params.status,
            priority=params.priority,
            assignee_id=params.assignee_id,
            search=params.search,
            limit=params.limit,
            offset=params.offset,
        )

        serialized = [
            TaskResponse.model_validate(t).model_dump(mode="json", by_alias=True)
            for t in tasks
        ]
        await self.cache_service.set(cache_key, serialized, ttl=settings.CACHE_TTL_TASKS)
        return tasks

    async def get_task(
        self,
        session: AsyncSession,
        task_id: str,
        current_user: Optional[UserTokenPayload] = None,
    ) -> Any:
        """Fetch single task by ID with cache-aside."""
        cache_key = self.cache_service.task_detail_key(task_id)
        cached = await self.cache_service.get(cache_key)
        if cached is not None:
            return cached

        task = await self.task_dao.get_by_id(session, task_id)
        if not task:
            raise NotFoundException(f"Task '{task_id}' not found")

        serialized = TaskResponse.model_validate(task).model_dump(mode="json", by_alias=True)
        await self.cache_service.set(cache_key, serialized, ttl=settings.CACHE_TTL_TASKS)
        return task

    async def create_task(
        self,
        session: AsyncSession,
        data: TaskCreate,
        current_user: UserTokenPayload,
    ) -> Task:
        """Validate relationships, project access, and create a new task."""
        project = await self.project_dao.get_by_id(session, data.project_id)
        if not project:
            raise NotFoundException(f"Project '{data.project_id}' not found")

        # Object-level project membership check
        if current_user.role != "ADMIN":
            is_member = (project.owner_id == current_user.id) or any(
                m.id == current_user.id for m in project.members
            )
            if not is_member:
                raise PermissionDeniedException("Forbidden: You must be a project member to create tasks in this project")

        # Assignee validation
        if data.assignee_id:
            assignee = await self.user_dao.get_by_id(session, data.assignee_id)
            if not assignee:
                raise NotFoundException(f"Assignee '{data.assignee_id}' not found")
            if current_user.role != "ADMIN":
                is_assignee_member = (project.owner_id == assignee.id) or any(
                    m.id == assignee.id for m in project.members
                )
                if not is_assignee_member:
                    raise ValidationException("Assignee is not an enrolled member of this project")

        col = await self.column_dao.get_by_id_ci(session, data.status)
        if not col:
            raise ValidationException(f"Workflow status column '{data.status}' does not exist")

        due = (
            data.due_date
            if isinstance(data.due_date, date)
            else date.fromisoformat(str(data.due_date).split("T")[0])
        )
        start = None
        if data.start_date:
            start = (
                data.start_date
                if isinstance(data.start_date, date)
                else date.fromisoformat(str(data.start_date).split("T")[0])
            )

        task_id = f"{project.key}-{uuid.uuid4().hex[:6].upper()}"

        task = Task(
            id=task_id,
            title=data.title.strip(),
            description=(data.description or "").strip(),
            status=data.status,
            priority=TaskPriority(data.priority),
            start_date=start,
            due_date=due,
            tags=data.tags or [],
            project_id=data.project_id,
            assignee_id=data.assignee_id if data.assignee_id else None,
            created_by_id=current_user.id,
        )
        created = await self.task_dao.create(session, task)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("tasks:*")
        await self.cache_service.delete_pattern("dashboard:*")
        await self.cache_service.delete_pattern("activities:*")

        # Audit log
        await self.activity_service.log_activity(
            session=session,
            action=ActivityAction.TASK_CREATED,
            details=f"Created task '{created.title}'",
            user_id=current_user.id,
            user_name=current_user.name,
            user_role=current_user.role,
            project_id=created.project_id,
            task_id=created.id,
        )

        return created

    async def update_task(
        self,
        session: AsyncSession,
        task_id: str,
        data: TaskUpdate,
        current_user: UserTokenPayload,
    ) -> Task:
        """Validate state machine progression and update task fields."""
        task = await self.task_dao.get_by_id(session, task_id)
        if not task:
            raise NotFoundException(f"Task '{task_id}' not found")

        # Member permissions check: can edit if Admin or assigned to user or created by user
        if current_user.role != "ADMIN":
            project = await self.project_dao.get_by_id(session, task.project_id)
            if project:
                is_member = (project.owner_id == current_user.id) or any(
                    m.id == current_user.id for m in project.members
                )
                if not is_member:
                    raise PermissionDeniedException("Forbidden: You do not have access to this project")

            can_edit = (task.assignee_id == current_user.id) or (task.created_by_id == current_user.id)
            if not can_edit:
                raise PermissionDeniedException("Forbidden: You can only update tasks assigned to you or created by you")

        status_changed = False
        old_status = task.status

        # 1. Workflow validation
        if data.status is not None and data.status != task.status:
            target_status = data.status.strip()
            col = await self.column_dao.get_by_id_ci(session, target_status)
            if not col:
                raise ValidationException(f"Workflow status column '{target_status}' does not exist")

            # Validate against illegal transition rules
            transition = (task.status.upper(), target_status.upper())
            if transition in ILLEGAL_TRANSITIONS:
                raise WorkflowRestrictionException(
                    f"Invalid workflow transition from '{task.status}' to '{target_status}'. "
                    "Progression must proceed sequentially: TODO -> IN_PROGRESS -> IN_REVIEW -> DONE"
                )

            task.status = target_status
            status_changed = True

        # 2. Assignee validation
        if data.assignee_id is not None:
            clean_assignee = data.assignee_id.strip() if data.assignee_id else None
            if clean_assignee:
                assignee = await self.user_dao.get_by_id(session, clean_assignee)
                if not assignee:
                    raise NotFoundException(f"Assignee '{clean_assignee}' not found")
                task.assignee_id = clean_assignee
            else:
                task.assignee_id = None

        # 3. Dates validation
        if data.due_date is not None:
            task.due_date = (
                data.due_date
                if isinstance(data.due_date, date)
                else date.fromisoformat(str(data.due_date).split("T")[0])
            )
        if data.start_date is not None:
            clean_start = str(data.start_date).strip() if data.start_date else ""
            if clean_start:
                task.start_date = (
                    data.start_date
                    if isinstance(data.start_date, date)
                    else date.fromisoformat(clean_start.split("T")[0])
                )
            else:
                task.start_date = None

        # 4. Content updates
        if data.title is not None:
            task.title = data.title.strip()
        if data.description is not None:
            task.description = data.description.strip()
        if data.priority is not None:
            task.priority = TaskPriority(data.priority)
        if data.tags is not None:
            task.tags = data.tags

        updated = await self.task_dao.update(session, task)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("tasks:*")
        await self.cache_service.delete_pattern("dashboard:*")
        await self.cache_service.delete_pattern("activities:*")
        await self.cache_service.delete(self.cache_service.task_detail_key(updated.id))

        # Audit log
        if status_changed:
            await self.activity_service.log_activity(
                session=session,
                action=ActivityAction.TASK_STATUS_CHANGED,
                details=f"Moved task '{updated.title}' from {old_status} to {updated.status}",
                user_id=current_user.id,
                user_name=current_user.name,
                user_role=current_user.role,
                project_id=updated.project_id,
                task_id=updated.id,
            )
        else:
            await self.activity_service.log_activity(
                session=session,
                action=ActivityAction.TASK_UPDATED,
                details=f"Updated task '{updated.title}'",
                user_id=current_user.id,
                user_name=current_user.name,
                user_role=current_user.role,
                project_id=updated.project_id,
                task_id=updated.id,
            )

        return updated

    async def delete_task(
        self,
        session: AsyncSession,
        task_id: str,
        current_user: UserTokenPayload,
    ) -> Task:
        """Delete task and record audit log (Admin or task creator only)."""
        task = await self.task_dao.get_by_id(session, task_id)
        if not task:
            raise NotFoundException(f"Task '{task_id}' not found")

        if current_user.role != "ADMIN" and task.created_by_id != current_user.id:
            raise PermissionDeniedException("Forbidden: Only administrators or the task creator can delete tasks")

        deleted = await self.task_dao.delete(session, task)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("tasks:*")
        await self.cache_service.delete_pattern("dashboard:*")
        await self.cache_service.delete_pattern("activities:*")
        await self.cache_service.delete(self.cache_service.task_detail_key(deleted.id))

        await self.activity_service.log_activity(
            session=session,
            action=ActivityAction.TASK_DELETED,
            details=f"Deleted task '{deleted.title}'",
            user_id=current_user.id,
            user_name=current_user.name,
            user_role=current_user.role,
            project_id=deleted.project_id,
            task_id=deleted.id,
        )

        return deleted

    async def get_dashboard_stats(
        self,
        session: AsyncSession,
        current_user: Optional[UserTokenPayload] = None,
        project_id: Optional[str] = None,
    ) -> DashboardStatsResponse:
        """Delegate dashboard metric aggregation to DashboardService."""
        return await self.dashboard_service.get_dashboard_stats(
            session=session,
            current_user=current_user,
            project_id=project_id,
        )


task_service = TaskService()
