"""Dashboard and telemetry API router."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_dashboard_service, get_db
from app.schemas.dashboard import DashboardStatsResponse
from app.schemas.user import UserTokenPayload
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_statistics(
    project_id: Optional[str] = Query(default=None, alias="projectId"),
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> DashboardStatsResponse:
    """Retrieve aggregated dashboard statistics and KPIs."""
    return await dashboard_service.get_dashboard_stats(
        session=session,
        current_user=current_user,
        project_id=project_id,
    )
