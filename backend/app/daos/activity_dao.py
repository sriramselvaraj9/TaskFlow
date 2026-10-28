"""Activity log Data Access Object."""

from typing import List, Optional
from datetime import datetime, timezone
import uuid
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.daos.base import BaseDAO
from app.models.activity import ActivityLog, ActivityAction


class ActivityDAO(BaseDAO[ActivityLog]):
    """DAO for activity audit log operations."""

    def __init__(self) -> None:
        super().__init__(ActivityLog)

    async def log_activity(
        self,
        session: AsyncSession,
        action: ActivityAction,
        details: str,
        user_id: str,
        user_name: str,
        user_role: str,
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
    ) -> ActivityLog:
        """Create and persist a new activity log entry."""
        activity = ActivityLog(
            id=str(uuid.uuid4()),
            action=action,
            details=details,
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            project_id=project_id,
            task_id=task_id,
            timestamp=datetime.now(timezone.utc),
        )
        session.add(activity)
        await session.flush()
        return activity

    async def get_recent(
        self,
        session: AsyncSession,
        limit: int = 20,
    ) -> List[ActivityLog]:
        """Fetch the most recent activity logs."""
        stmt = (
            select(ActivityLog)
            .order_by(desc(ActivityLog.timestamp))
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


activity_dao = ActivityDAO()
