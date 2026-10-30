"""Tasks API router."""

from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.background_tasks import record_audit_telemetry
from app.core.dependencies import get_current_user, get_db, get_task_service
from app.schemas.common import MessageResponse
from app.schemas.task import TaskCreate, TaskFilterParams, TaskResponse, TaskUpdate
from app.schemas.user import UserTokenPayload
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    project_id: Optional[str] = Query(default=None, alias="projectId"),
    status_filter: Optional[str] = Query(default="ALL", alias="status"),
    priority: Optional[str] = Query(default="ALL"),
    assignee_id: Optional[str] = Query(default="ALL", alias="assigneeId"),
    search: Optional[str] = Query(default=None),
    limit: Optional[int] = Query(default=None, ge=1, le=100),
    offset: Optional[int] = Query(default=None, ge=0),
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
) -> List[TaskResponse]:
    """Retrieve tasks with optional multi-criteria filtering and pagination."""
    params = TaskFilterParams(
        project_id=project_id,
        status=status_filter,
        priority=priority,
        assignee_id=assignee_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    tasks = await task_service.get_tasks(session, params, current_user)
    return [TaskResponse.model_validate(t) for t in tasks]


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Create a new task under a project."""
    task = await task_service.create_task(session, data, current_user)
    # Lightweight auxiliary background telemetry with serializable identifiers
    background_tasks.add_task(
        record_audit_telemetry,
        action="TASK_CREATED",
        entity_type="task",
        entity_id=task.id,
        actor_id=current_user.id,
        extra_context={"project_id": task.project_id, "status": task.status},
    )
    return TaskResponse.model_validate(task)


@router.get("/{id}", response_model=TaskResponse)
async def get_task(
    id: str,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Retrieve single task by its identifier."""
    task = await task_service.get_task(session, id, current_user)
    return TaskResponse.model_validate(task)


@router.put("/{id}", response_model=TaskResponse)
async def update_task(
    id: str,
    data: TaskUpdate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Update task details and validate workflow state transitions."""
    updated = await task_service.update_task(session, id, data, current_user)
    background_tasks.add_task(
        record_audit_telemetry,
        action="TASK_UPDATED",
        entity_type="task",
        entity_id=updated.id,
        actor_id=current_user.id,
    )
    return TaskResponse.model_validate(updated)


@router.delete("/{id}", response_model=MessageResponse)
async def delete_task(
    id: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    task_service: TaskService = Depends(get_task_service),
) -> MessageResponse:
    """Delete a task from the board."""
    await task_service.delete_task(session, id, current_user)
    background_tasks.add_task(
        record_audit_telemetry,
        action="TASK_DELETED",
        entity_type="task",
        entity_id=id,
        actor_id=current_user.id,
    )
    return MessageResponse(message="Task deleted successfully")

