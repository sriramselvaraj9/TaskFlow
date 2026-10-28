"""Activity audit logging service."""

from typing import Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheService, cache_service as default_cache_service
from app.core.config import settings
from app.daos.activity_dao import ActivityDAO, activity_dao as default_activity_dao
from app.models.activity import ActivityAction, ActivityLog
from app.schemas.activity import ActivityLogResponse


class ActivityService:
    """Service for managing workspace audit logs."""

    def __init__(
        self,
        activity_dao: Optional[ActivityDAO] = None,
        cache_service: Optional[CacheService] = None,
    ) -> None:
        self.activity_dao = activity_dao or default_activity_dao
        self.cache_service = cache_service or default_cache_service

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
        """Create and persist an activity log."""
        created = await self.activity_dao.log_activity(
            session=session,
            action=action,
            details=details,
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            project_id=project_id,
            task_id=task_id,
        )

        # Invalidate activity cache entries
        await self.cache_service.delete_pattern("activities:*")

        return created

    async def get_recent_activities(
        self,
        session: AsyncSession,
        limit: int = 20,
    ) -> List[Any]:
        """Fetch the most recent activity records with cache-aside."""
        cache_key = self.cache_service.activities_key(limit)
        cached = await self.cache_service.get(cache_key)
        if cached is not None:
            return cached

        activities = await self.activity_dao.get_recent(session=session, limit=limit)
        serialized = [
            ActivityLogResponse.model_validate(a).model_dump(mode="json", by_alias=True)
            for a in activities
        ]
        await self.cache_service.set(cache_key, serialized, ttl=settings.CACHE_TTL_ACTIVITIES)
        return activities


activity_service = ActivityService()
