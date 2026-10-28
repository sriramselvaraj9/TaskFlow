"""Dashboard statistics and telemetry service."""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheService, cache_service as default_cache_service
from app.core.config import settings
from app.core.exceptions import NotFoundException, PermissionDeniedException
from app.daos.project_dao import ProjectDAO, project_dao as default_project_dao
from app.daos.task_dao import TaskDAO, task_dao as default_task_dao
from app.schemas.dashboard import DashboardStatsResponse
from app.schemas.user import UserTokenPayload


class DashboardService:
    """Business operations for workspace metrics, KPIs, and completion rates."""

    def __init__(
        self,
        task_dao: Optional[TaskDAO] = None,
        project_dao: Optional[ProjectDAO] = None,
        cache_service: Optional[CacheService] = None,
    ) -> None:
        self.task_dao = task_dao or default_task_dao
        self.project_dao = project_dao or default_project_dao
        self.cache_service = cache_service or default_cache_service

    async def get_dashboard_stats(
        self,
        session: AsyncSession,
        current_user: Optional[UserTokenPayload] = None,
        project_id: Optional[str] = None,
    ) -> DashboardStatsResponse:
        """Aggregate workspace metrics and compute completion rate with cache-aside."""
        # 1. Authorization check before cache lookup to prevent authorization bypass
        if project_id and current_user and current_user.role != "ADMIN":
            project = await self.project_dao.get_by_id(session, project_id)
            if not project:
                raise NotFoundException(f"Project '{project_id}' not found")
            is_member = (project.owner_id == current_user.id) or any(
                m.id == current_user.id for m in project.members
            )
            if not is_member:
                raise PermissionDeniedException("Forbidden: You do not have access to this project")

        # 2. Cache-aside lookup
        cache_key = self.cache_service.dashboard_key(
            user_id=current_user.id if current_user else None,
            project_id=project_id,
            role=current_user.role if current_user else None,
        )
        cached = await self.cache_service.get(cache_key)
        if cached is not None:
            return DashboardStatsResponse.model_validate(cached)

        # 3. Database aggregation on cache miss
        (
            total_tasks,
            completed_tasks,
            in_progress_tasks,
            overdue_count,
            assigned_to_me,
            status_counts,
            priority_counts,
        ) = await self.task_dao.get_dashboard_metrics(
            session=session,
            user_id=current_user.id if current_user else None,
            project_id=project_id,
        )

        active_projects = await self.project_dao.count_active(session)

        completion_rate = (
            int(round((completed_tasks / total_tasks) * 100))
            if total_tasks > 0
            else 0
        )

        stats = DashboardStatsResponse(
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            in_progress_tasks=in_progress_tasks,
            overdue_tasks=overdue_count,
            overdue_count=overdue_count,
            assigned_to_me=assigned_to_me,
            active_projects=active_projects,
            completion_rate=completion_rate,
            tasks_by_status=status_counts,
            tasks_by_priority=priority_counts,
        )

        # 4. Cache result with configurable TTL (default 60s)
        await self.cache_service.set(
            cache_key,
            stats.model_dump(mode="json", by_alias=True),
            ttl=settings.CACHE_TTL_DASHBOARD,
        )

        return stats


dashboard_service = DashboardService()
