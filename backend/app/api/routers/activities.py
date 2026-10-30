"""Activity audit log API router."""

from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_activity_service, get_current_user, get_db
from app.schemas.activity import ActivityLogResponse
from app.schemas.user import UserTokenPayload
from app.services.activity_service import ActivityService

router = APIRouter(prefix="/activities", tags=["Activities"])


@router.get("", response_model=List[ActivityLogResponse])
async def list_activities(
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    activity_service: ActivityService = Depends(get_activity_service),
) -> List[ActivityLogResponse]:
    """Retrieve recent activity audit logs."""
    activities = await activity_service.get_recent_activities(session, limit=limit)
    return [ActivityLogResponse.model_validate(a) for a in activities]
