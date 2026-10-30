"""Projects API router."""

from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.background_tasks import record_audit_telemetry
from app.core.dependencies import get_current_user, get_db, get_project_service, require_admin
from app.schemas.common import MessageResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.schemas.user import UserTokenPayload
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> List[ProjectResponse]:
    """Retrieve all projects accessible to the authenticated user."""
    projects = await project_service.get_projects(session, current_user)
    return [ProjectResponse.model_validate(p) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(require_admin),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    """Create a new workspace project (Admin only)."""
    project = await project_service.create_project(session, data, current_user)
    background_tasks.add_task(
        record_audit_telemetry,
        action="PROJECT_CREATED",
        entity_type="project",
        entity_id=project.id,
        actor_id=current_user.id,
        extra_context={"key": project.key, "name": project.name},
    )
    return ProjectResponse.model_validate(project)


@router.get("/{id}", response_model=ProjectResponse)
async def get_project(
    id: str,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    """Retrieve a project by its identifier."""
    project = await project_service.get_project(session, id, current_user)
    return ProjectResponse.model_validate(project)


@router.put("/{id}", response_model=ProjectResponse)
async def update_project(
    id: str,
    data: ProjectUpdate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    """Update settings and member assignments for an existing project."""
    updated = await project_service.update_project(session, id, data, current_user)
    background_tasks.add_task(
        record_audit_telemetry,
        action="PROJECT_UPDATED",
        entity_type="project",
        entity_id=updated.id,
        actor_id=current_user.id,
    )
    return ProjectResponse.model_validate(updated)


@router.delete("/{id}", response_model=MessageResponse)
async def delete_project(
    id: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(require_admin),
    project_service: ProjectService = Depends(get_project_service),
) -> MessageResponse:
    """Delete a project and cascade deletion to its tasks (Admin only)."""
    await project_service.delete_project(session, id, current_user)
    background_tasks.add_task(
        record_audit_telemetry,
        action="PROJECT_DELETED",
        entity_type="project",
        entity_id=id,
        actor_id=current_user.id,
    )
    return MessageResponse(message="Project deleted successfully")

