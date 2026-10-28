"""Generic Base DAO using SQLAlchemy 2.0 async queries."""

from typing import Any, Generic, List, Optional, Type, TypeVar
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseDAO(Generic[ModelType]):
    """Generic CRUD operations for SQLAlchemy models."""

    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get_by_id(self, session: AsyncSession, id: Any) -> Optional[ModelType]:
        """Fetch a single record by primary key."""
        stmt = select(self.model).where(self.model.id == id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get(self, session: AsyncSession, id: Any) -> Optional[ModelType]:
        """Alias for get_by_id."""
        return await self.get_by_id(session, id)

    async def get_multi(
        self,
        session: AsyncSession,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ModelType]:
        """Fetch multiple records with pagination."""
        stmt = select(self.model).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, session: AsyncSession, obj_in: ModelType) -> ModelType:
        """Persist a new entity instance."""
        session.add(obj_in)
        await session.flush()
        return obj_in

    async def update(self, session: AsyncSession, obj_in: ModelType) -> ModelType:
        """Update and flush an entity instance."""
        session.add(obj_in)
        await session.flush()
        await session.refresh(obj_in)
        return obj_in

    async def delete(self, session: AsyncSession, obj_or_id: Any) -> Optional[ModelType]:
        """Delete an entity instance or find and delete by primary key."""
        if isinstance(obj_or_id, self.model):
            obj = obj_or_id
        else:
            obj = await self.get_by_id(session, obj_or_id)
        if obj:
            await session.delete(obj)
            await session.flush()
        return obj
