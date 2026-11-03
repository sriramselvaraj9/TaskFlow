"""Health and diagnostic endpoint."""

from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health", response_model=Dict[str, Any])
async def get_system_health() -> Dict[str, Any]:
    """Diagnostic health endpoint reporting service availability."""
    return {
        "service": settings.APP_NAME,
        "message": "APIs are running successfully",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
