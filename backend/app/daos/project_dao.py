"""Project Data Access Object."""

from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.daos.base import BaseDAO
from app.models.project import Project, ProjectStatus, project_members
from app.models.user import User


class ProjectDAO(BaseDAO[Project]):
    """Data Access Object for Project entity with eager member loading."""

    def __init__(self):
        super().__init__(Project)

    async def get_by_id(self, session: AsyncSession, id: str) -> Optional[Project]:
        """Fetch project by ID with members eager-loaded via selectinload."""
        stmt = (
            select(Project)
            .options(selectinload(Project.members))
            .where(Project.id == id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_key(self, session: AsyncSession, key: str) -> Optional[Project]:
        """Fetch project by uppercase key."""
        stmt = select(Project).where(Project.key == key.strip().upper())
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, session: AsyncSession) -> List[Project]:
        """Fetch all projects ordered by creation date descending with members loaded."""
        stmt = (
            select(Project)
            .options(selectinload(Project.members))
            .order_by(Project.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def count_active(self, session: AsyncSession) -> int:
        """Count projects currently marked ACTIVE."""
        stmt = select(func.count(Project.id)).where(Project.status == ProjectStatus.ACTIVE)
        result = await session.execute(stmt)
        return result.scalar_one()

    async def add_user_to_all_projects(self, session: AsyncSession, user: User) -> None:
        """Automatically enrolls a newly provisioned user into all active projects."""
        projects = await self.get_all(session)
        for proj in projects:
            if user not in proj.members:
                proj.members.append(user)
        await session.flush()

    async def remove_user_from_all_projects(self, session: AsyncSession, user_id: str) -> None:
        """Removes user from project_members association table across all projects."""
        stmt = project_members.delete().where(project_members.c.user_id == user_id)
        await session.execute(stmt)
        await session.flush()


project_dao = ProjectDAO()
