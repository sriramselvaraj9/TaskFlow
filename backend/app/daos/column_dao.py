"""Board Column Data Access Object."""

from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.daos.base import BaseDAO
from app.models.column import BoardColumn


class ColumnDAO(BaseDAO[BoardColumn]):
    """Data Access Object for BoardColumn entity."""

    def __init__(self):
        super().__init__(BoardColumn)

    async def get_all_ordered(self, session: AsyncSession) -> List[BoardColumn]:
        """Fetch all columns ordered by sort_order ascending."""
        stmt = select(BoardColumn).order_by(BoardColumn.order.asc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id_ci(self, session: AsyncSession, id: str) -> Optional[BoardColumn]:
        """Fetch column by case-insensitive ID."""
        stmt = select(BoardColumn).where(BoardColumn.id.ilike(id.strip()))
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_max_order(self, session: AsyncSession) -> int:
        """Find highest sort order value across columns."""
        stmt = select(func.coalesce(func.max(BoardColumn.order), -1))
        result = await session.execute(stmt)
        return result.scalar_one()

    async def reorder(self, session: AsyncSession, column_ids: List[str]) -> List[BoardColumn]:
        """Atomically updates order indices for listed column IDs."""
        cols = await self.get_all_ordered(session)
        col_map = {c.id: c for c in cols}

        for idx, col_id in enumerate(column_ids):
            if col_id in col_map:
                col_map[col_id].order = idx

        await session.flush()
        return await self.get_all_ordered(session)


column_dao = ColumnDAO()
