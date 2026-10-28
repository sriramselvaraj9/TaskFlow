"""Lightweight, non-critical background task handlers.

CRITICAL DESIGN RULES:
1. Used ONLY for non-critical telemetry, metrics, or lightweight audit notifications.
2. Database transactions, security revocations, and required email deliveries remain synchronous.
3. Handlers accept ONLY serializable primitive types (str, int, dict), NEVER db sessions or request objects.
4. All exceptions are caught and logged server-side to guarantee background resilience.
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("taskflow.background")


async def record_audit_telemetry(
    action: str,
    entity_type: str,
    entity_id: str,
    actor_id: Optional[str] = None,
    extra_context: Optional[Dict[str, Any]] = None,
) -> None:
    """Non-critical background dispatch for operational audit metrics.
    
    Accepts only primitive serializable identifiers. Exceptions are caught and logged safely.
    """
    try:
        logger.info(
            "Background audit telemetry recorded: action=%s entity_type=%s entity_id=%s actor_id=%s extra=%s",
            action,
            entity_type,
            entity_id,
            actor_id or "anonymous",
            extra_context or {},
        )
    except Exception as exc:
        logger.exception("Failed to execute background audit telemetry: %s", exc)


async def send_lightweight_notification(
    recipient_email: str,
    notification_type: str,
    entity_id: str,
) -> None:
    """Non-critical background notification / webhook event dispatch.
    
    Accepts only primitive strings. Exceptions are caught and logged safely.
    """
    try:
        logger.info(
            "Background notification dispatched: type=%s recipient=%s entity_id=%s",
            notification_type,
            recipient_email,
            entity_id,
        )
    except Exception as exc:
        logger.exception("Failed to dispatch background notification to %s: %s", recipient_email, exc)
