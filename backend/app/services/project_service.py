"""Project management business service."""

import re
from typing import Any, List, Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheService, cache_service as default_cache_service
from app.core.config import settings
from app.core.exceptions import (
    ConflictException,
    NotFoundException,
    PermissionDeniedException,
)
from app.daos.project_dao import ProjectDAO, project_dao as default_project_dao
from app.daos.user_dao import UserDAO, user_dao as default_user_dao
from app.models.activity import ActivityAction
from app.models.project import Project, ProjectStatus
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.schemas.user import UserTokenPayload
from app.services.activity_service import ActivityService, activity_service as default_activity_service


class ProjectService:
    """Business operations for Projects and their memberships."""

    def __init__(
        self,
        project_dao: Optional[ProjectDAO] = None,
        user_dao: Optional[UserDAO] = None,
        activity_service: Optional[ActivityService] = None,
        cache_service: Optional[CacheService] = None,
    ) -> None:
        self.project_dao = project_dao or default_project_dao
        self.user_dao = user_dao or default_user_dao
        self.activity_service = activity_service or default_activity_service
        self.cache_service = cache_service or default_cache_service

    async def get_projects(
        self,
        session: AsyncSession,
        current_user: Optional[UserTokenPayload] = None,
    ) -> List[Any]:
        """Fetch all projects ordered by newest with members eager loaded and cache-aside."""
        cache_key = self.cache_service.projects_list_key(
            user_id=current_user.id if current_user else None,
            role=current_user.role if current_user else None,
        )
        cached = await self.cache_service.get(cache_key)
        if cached is not None:
            return cached

        projects = await self.project_dao.get_all(session)
        serialized = [
            ProjectResponse.model_validate(p).model_dump(mode="json", by_alias=True)
            for p in projects
        ]
        await self.cache_service.set(cache_key, serialized, ttl=settings.CACHE_TTL_PROJECTS)
        return projects

    async def get_project(
        self,
        session: AsyncSession,
        project_id: str,
        current_user: Optional[UserTokenPayload] = None,
    ) -> Any:
        """Fetch single project by ID with cache-aside."""
        cache_key = self.cache_service.project_detail_key(
            project_id=project_id,
            user_id=current_user.id if current_user else None,
        )
        cached = await self.cache_service.get(cache_key)
        if cached is not None:
            return cached

        project = await self.project_dao.get_by_id(session, project_id)
        if not project:
            raise NotFoundException(f"Project '{project_id}' not found")

        serialized = ProjectResponse.model_validate(project).model_dump(mode="json", by_alias=True)
        await self.cache_service.set(cache_key, serialized, ttl=settings.CACHE_TTL_PROJECTS)
        return project

    async def create_project(
        self,
        session: AsyncSession,
        data: ProjectCreate,
        current_user: UserTokenPayload,
    ) -> Project:
        """Create a new workspace project (Admin only)."""
        if current_user.role != "ADMIN":
            raise PermissionDeniedException("Forbidden: Administrator privileges required to create projects")

        # Derive or validate key
        key = data.key.strip().upper() if data.key else ""
        if not key:
            alpha = re.sub(r"[^A-Za-z0-9]", "", data.name).upper()
            key = alpha[:4] if len(alpha) >= 2 else f"PRJ{uuid.uuid4().hex[:3].upper()}"

        existing_key = await self.project_dao.get_by_key(session, key)
        if existing_key:
            raise ConflictException(f"Project with key '{key}' already exists")

        # Resolve initial members strictly from provided member_ids
        members = []
        if data.member_ids:
            clean_member_ids = [
                mid.strip()
                for mid in data.member_ids
                if mid and mid.strip() and mid.strip().lower() not in ("string", "none", "null")
            ]
            if clean_member_ids:
                members = await self.user_dao.get_by_ids(session, clean_member_ids)

        project = Project(
            id=str(uuid.uuid4()),
            name=data.name.strip(),
            key=key,
            description=(data.description or "").strip(),
            status=ProjectStatus.ACTIVE,
            owner_id=current_user.id,
            members=members,
        )
        created = await self.project_dao.create(session, project)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("projects:*")
        await self.cache_service.delete_pattern("project:*")
        await self.cache_service.delete_pattern("tasks:*")
        await self.cache_service.delete_pattern("dashboard:*")
        await self.cache_service.delete_pattern("activities:*")

        # Log activity
        await self.activity_service.log_activity(
            session=session,
            action=ActivityAction.PROJECT_CREATED,
            details=f"Created project '{created.name}'",
            user_id=current_user.id,
            user_name=current_user.name,
            user_role=current_user.role,
            project_id=created.id,
        )

        return created

    async def update_project(
        self,
        session: AsyncSession,
        project_id: str,
        data: ProjectUpdate,
        current_user: UserTokenPayload,
    ) -> Project:
        """Update an existing project's metadata or membership (Admin or Owner only)."""
        project = await self.project_dao.get_by_id(session, project_id)
        if not project:
            raise NotFoundException(f"Project '{project_id}' not found")

        if current_user.role != "ADMIN" and project.owner_id != current_user.id:
            raise PermissionDeniedException("Forbidden: Only administrators or project owners can update projects")

        if data.name is not None:
            project.name = data.name.strip()
        if data.description is not None:
            project.description = data.description.strip()
        if data.status is not None:
            project.status = ProjectStatus(data.status)
        if data.member_ids is not None:
            users = await self.user_dao.get_by_ids(session, data.member_ids)
            project.members = users

        await self.project_dao.update(session, project)
        refetched = await self.project_dao.get_by_id(session, project_id)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("projects:*")
        await self.cache_service.delete_pattern("project:*")
        await self.cache_service.delete_pattern("tasks:*")
        await self.cache_service.delete_pattern("dashboard:*")
        await self.cache_service.delete_pattern("activities:*")

        return refetched or project

    async def delete_project(
        self,
        session: AsyncSession,
        project_id: str,
        current_user: UserTokenPayload,
    ) -> Project:
        """Delete project and cascade deletion to contained tasks (Admin only)."""
        if current_user.role != "ADMIN":
            raise PermissionDeniedException("Forbidden: Administrator privileges required to delete projects")

        project = await self.project_dao.get_by_id(session, project_id)
        if not project:
            raise NotFoundException(f"Project '{project_id}' not found")

        deleted = await self.project_dao.delete(session, project)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("projects:*")
        await self.cache_service.delete_pattern("project:*")
        await self.cache_service.delete_pattern("tasks:*")
        await self.cache_service.delete_pattern("dashboard:*")
        await self.cache_service.delete_pattern("activities:*")

        return deleted


project_service = ProjectService()
