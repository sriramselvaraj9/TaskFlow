"""Health and diagnostic endpoint."""

from datetime import datetime, timezone
import logging
import time
from typing import Any, Dict
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.core.redis import get_redis

logger = logging.getLogger("taskflow.health")
router = APIRouter()
START_TIME = time.time()


async def _check_database_connectivity() -> str:
    """Verifies PostgreSQL connectivity with a lightweight ping."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "connected"
    except Exception as exc:
        logger.warning("Database health probe failed: %s", exc)
        return "disconnected"


async def _check_redis_connectivity() -> str:
    """Verifies Redis cache/session connectivity with a PING."""
    try:
        client = await get_redis()
        pong = await client.ping()
        return "connected" if pong else "disconnected"
    except Exception as exc:
        logger.warning("Redis health probe failed: %s", exc)
        return "disconnected"


@router.get("/health", response_model=Dict[str, Any])
async def get_system_health() -> Dict[str, Any]:
    """Telemetry diagnostic endpoint reporting application and dependency status without exposing secrets."""
    uptime = int(time.time() - START_TIME)
    db_status = await _check_database_connectivity()
    redis_status = await _check_redis_connectivity()

    # Determine aggregated operational health
    is_healthy = (db_status == "connected") and (redis_status == "connected")
    overall_status = "healthy" if is_healthy else "degraded"
    api_health = "operational" if is_healthy else "degraded"

    return {
        "appName": settings.APP_NAME,
        "apiHealth": api_health,
        "status": overall_status,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptimeSeconds": uptime,
        "dependencies": {
            "database": db_status,
            "redis": redis_status,
        },
        "environment": {
            "nodeEnv": "development" if settings.ENVIRONMENT == "development" else settings.ENVIRONMENT,
            "nextAuthUrlConfigured": bool(settings.FRONTEND_URL),
            "nextAuthSecretConfigured": bool(settings.JWT_SECRET),
            "emailServiceReady": bool(settings.BREVO_API_KEY or settings.SMTP_HOST),
            "emailProvider": "SMTP / Brevo" if (settings.BREVO_API_KEY or settings.SMTP_HOST) else "Not Configured (Fallback logging enabled)",
            "senderVerifiedEmailConfigured": bool(settings.BREVO_FROM or settings.SMTP_FROM),
        },
    }

