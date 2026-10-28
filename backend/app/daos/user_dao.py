"""User Data Access Object."""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.daos.base import BaseDAO
from app.models.user import User


class UserDAO(BaseDAO[User]):
    """Data Access Object for User entity."""

    def __init__(self):
        super().__init__(User)

    async def get_by_email(self, session: AsyncSession, email: str) -> Optional[User]:
        """Fetch user by case-insensitive email."""
        clean_email = email.strip().lower()
        stmt = select(User).where(User.email.ilike(clean_email))
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, session: AsyncSession) -> List[User]:
        """Fetch all users ordered by creation date ascending."""
        stmt = select(User).order_by(User.created_at.asc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_ids(self, session: AsyncSession, ids: List[str]) -> List[User]:
        """Fetch multiple users by primary key list."""
        if not ids:
            return []
        stmt = select(User).where(User.id.in_(ids))
        result = await session.execute(stmt)
        return list(result.scalars().all())


user_dao = UserDAO()
