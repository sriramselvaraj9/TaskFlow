"""Board column business service."""

import re
from typing import Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheService, cache_service as default_cache_service
from app.core.config import settings
from app.core.exceptions import ConflictException, NotFoundException, ValidationException, WorkflowRestrictionException
from app.daos.column_dao import ColumnDAO, column_dao as default_column_dao
from app.daos.task_dao import TaskDAO, task_dao as default_task_dao
from app.models.activity import ActivityAction
from app.models.column import BoardColumn
from app.schemas.column import ColumnCreate, ColumnResponse
from app.schemas.user import UserTokenPayload
from app.services.activity_service import ActivityService, activity_service as default_activity_service

PROTECTED_COLUMNS = {"BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"}


class ColumnService:
    """Business operations for Kanban workflow columns."""

    def __init__(
        self,
        column_dao: Optional[ColumnDAO] = None,
        task_dao: Optional[TaskDAO] = None,
        activity_service: Optional[ActivityService] = None,
        cache_service: Optional[CacheService] = None,
    ) -> None:
        self.column_dao = column_dao or default_column_dao
        self.task_dao = task_dao or default_task_dao
        self.activity_service = activity_service or default_activity_service
        self.cache_service = cache_service or default_cache_service

    async def get_columns(self, session: AsyncSession) -> List[Any]:
        """Fetch all columns ordered by display sequence with cache-aside."""
        cache_key = self.cache_service.columns_list_key()
        cached = await self.cache_service.get(cache_key)
        if cached is not None:
            return cached

        columns = await self.column_dao.get_all_ordered(session)
        serialized = [
            ColumnResponse.model_validate(c).model_dump(mode="json", by_alias=True)
            for c in columns
        ]
        await self.cache_service.set(cache_key, serialized, ttl=settings.CACHE_TTL_COLUMNS)
        return columns

    async def create_column(
        self,
        session: AsyncSession,
        data: ColumnCreate,
        current_user: UserTokenPayload,
    ) -> BoardColumn:
        """Create a new custom workflow column with automatic ordering."""
        # Normalize column ID from title
        clean_title = data.title.strip()
        col_id = re.sub(r"[^A-Za-z0-9_]+", "_", clean_title.upper()).strip("_")
        if not col_id:
            raise ValidationException("Invalid column title")

        # Check uniqueness of ID
        existing = await self.column_dao.get_by_id_ci(session, col_id)
        if existing:
            raise ConflictException(f"Column with ID '{col_id}' already exists")

        # Check uniqueness of title
        existing_cols = await self.column_dao.get_all_ordered(session)
        for c in existing_cols:
            if c.title.strip().lower() == clean_title.lower():
                raise ConflictException(f"Column '{clean_title}' already exists")

        max_order = await self.column_dao.get_max_order(session)
        column = BoardColumn(
            id=col_id,
            title=clean_title,
            dot_color=data.dot_color or "bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]",
            accent_color=data.accent_color or "border-slate-900",
            order=max_order + 1,
        )
        created = await self.column_dao.create(session, column)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("columns:*")
        await self.cache_service.delete_pattern("tasks:*")
        await self.cache_service.delete_pattern("dashboard:*")
        await self.cache_service.delete_pattern("activities:*")

        # Log activity
        await self.activity_service.log_activity(
            session=session,
            action=ActivityAction.COLUMN_CREATED,
            details=f"Created column '{created.title}'",
            user_id=current_user.id,
            user_name=current_user.name,
            user_role=current_user.role,
        )

        return created

    async def reorder_columns(
        self,
        session: AsyncSession,
        column_ids: List[str],
        current_user: UserTokenPayload,
    ) -> List[BoardColumn]:
        """Atomically update column order sequence."""
        if len(column_ids) != len(set(column_ids)):
            raise ValidationException("Duplicate column IDs in reorder payload")

        existing_cols = await self.column_dao.get_all_ordered(session)
        existing_ids = {c.id for c in existing_cols}

        if set(column_ids) != existing_ids:
            raise ValidationException("Reorder payload does not match existing columns")

        reordered = await self.column_dao.reorder(session, column_ids)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("columns:*")
        await self.cache_service.delete_pattern("tasks:*")
        await self.cache_service.delete_pattern("dashboard:*")
        await self.cache_service.delete_pattern("activities:*")

        return reordered

    async def delete_column(
        self,
        session: AsyncSession,
        column_id: str,
        current_user: UserTokenPayload,
    ) -> Tuple[BoardColumn, int]:
        """Delete custom column and migrate tasks to Backlog."""
        normalized_id = column_id.strip()
        if normalized_id.upper() in PROTECTED_COLUMNS:
            raise WorkflowRestrictionException(
                f"Cannot delete protected default column '{normalized_id}'"
            )

        col = await self.column_dao.get_by_id(session, normalized_id)
        if not col:
            raise NotFoundException(f"Column '{normalized_id}' not found")

        # Migrate all tasks under this column to BACKLOG
        moved_tasks_count = await self.task_dao.migrate_column_tasks(
            session=session,
            column_id=normalized_id,
            new_status="BACKLOG",
        )

        deleted_col = await self.column_dao.delete(session, col)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("columns:*")
        await self.cache_service.delete_pattern("tasks:*")
        await self.cache_service.delete_pattern("dashboard:*")
        await self.cache_service.delete_pattern("activities:*")

        # Audit log
        await self.activity_service.log_activity(
            session=session,
            action=ActivityAction.COLUMN_DELETED,
            details=f"Deleted column '{deleted_col.title}' and moved {moved_tasks_count} tasks to Backlog",
            user_id=current_user.id,
            user_name=current_user.name,
            user_role=current_user.role,
        )

        return deleted_col, moved_tasks_count


column_service = ColumnService()
