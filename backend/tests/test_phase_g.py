"""Phase G Comprehensive Verification Test Suite.

Covers:
1. Centralized exception handling and status code mapping (400, 401, 403, 404, 409, 429, 503, 500).
2. Frontend error response contract preservation (message, column reorder error key, Pydantic validation errors).
3. Secret redaction and traceback masking on 500 internal server errors.
4. Request ID generation, client ID validation, and X-Request-ID / X-Process-Time response headers.
5. Structured access logging and sensitive credential redaction.
6. CORS behavior (allowed origins, disallowed origins, preflight OPTIONS, allowed methods/headers, exposed headers).
7. Health endpoint dependency probing without secret exposure.
8. Non-critical background task execution, primitive parameter serialization, and resilient exception handling.
"""

import logging
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import APIRouter, BackgroundTasks, FastAPI, Request, status
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
import pytest
from starlette.middleware.cors import CORSMiddleware

from app.routers import api_router
from app.core.background_tasks import record_audit_telemetry, send_lightweight_notification
from app.core.config import settings
from app.core.exceptions import (
    AuthenticationException,
    ConflictException,
    DependencyFailureException,
    NotFoundException,
    PermissionDeniedException,
    RateLimitException,
    TaskFlowException,
    ValidationException,
    WorkflowRestrictionException,
    register_exception_handlers,
)
from app.core.logging_config import SensitiveDataFilter, mask_sensitive_data, mask_sensitive_string
from app.core.middleware import RequestTrackingMiddleware
from app.main import app as main_app


@pytest.fixture
def phase_g_app():
    """Isolated FastAPI test instance with Phase G middleware and handlers."""
    test_app = FastAPI(title="Phase G Test")
    test_app.add_middleware(RequestTrackingMiddleware)
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=settings.CORS_ALLOWED_METHODS,
        allow_headers=settings.CORS_ALLOWED_HEADERS,
        expose_headers=["X-Request-ID", "X-Process-Time"],
    )
    register_exception_handlers(test_app)

    # Diagnostic trigger routes for testing domain exceptions
    @test_app.get("/trigger-not-found")
    async def trigger_not_found():
        raise NotFoundException("Target entity was not found")

    @test_app.get("/trigger-validation")
    async def trigger_validation():
        raise ValidationException("Field value is invalid")

    @test_app.get("/trigger-conflict")
    async def trigger_conflict():
        raise ConflictException("Entity with this key already exists")

    @test_app.get("/trigger-permission")
    async def trigger_permission():
        raise PermissionDeniedException("Insufficient role authorization")

    @test_app.get("/trigger-auth")
    async def trigger_auth():
        raise AuthenticationException("Invalid or expired session token")

    @test_app.get("/trigger-ratelimit")
    async def trigger_ratelimit():
        raise RateLimitException("Exceeded maximum request threshold")

    @test_app.get("/trigger-dependency")
    async def trigger_dependency():
        raise DependencyFailureException("External cache service unreachable")

    @test_app.get("/trigger-500")
    async def trigger_unexpected():
        # Raises unexpected exception with internal database password in message
        raise RuntimeError("Database connection string postgresql://admin:SuperSecretPass123@db:5432 failed")

    @test_app.put("/api/columns/reorder")
    async def trigger_reorder_error():
        raise ValidationException("Invalid column sequence")

    @test_app.post("/trigger-background")
    async def trigger_background(background_tasks: BackgroundTasks):
        background_tasks.add_task(
            record_audit_telemetry,
            action="TEST_ACTION",
            entity_type="test_entity",
            entity_id="entity_999",
            actor_id="user_123",
            extra_context={"env": "testing"},
        )
        return {"status": "enqueued"}

    return test_app


# ============================================================================
# 1. Centralized Domain Exception & Status Code Mapping Tests
# ============================================================================

@pytest.mark.asyncio
async def test_domain_exception_status_codes_and_payload_contracts(phase_g_app):
    """Verify each domain exception maps to its standard HTTP status code and response payload."""
    async with AsyncClient(transport=ASGITransport(app=phase_g_app), base_url="http://test") as client:
        # 404 Not Found
        res_404 = await client.get("/trigger-not-found")
        assert res_404.status_code == status.HTTP_404_NOT_FOUND
        assert res_404.json() == {"message": "Target entity was not found"}
        assert "X-Request-ID" in res_404.headers

        # 400 Validation
        res_400 = await client.get("/trigger-validation")
        assert res_400.status_code == status.HTTP_400_BAD_REQUEST
        assert res_400.json() == {"message": "Field value is invalid"}

        # 409 Conflict
        res_409 = await client.get("/trigger-conflict")
        assert res_409.status_code == status.HTTP_409_CONFLICT
        assert res_409.json() == {"message": "Entity with this key already exists"}

        # 403 Forbidden
        res_403 = await client.get("/trigger-permission")
        assert res_403.status_code == status.HTTP_403_FORBIDDEN
        assert res_403.json() == {"message": "Insufficient role authorization"}

        # 401 Unauthorized
        res_401 = await client.get("/trigger-auth")
        assert res_401.status_code == status.HTTP_401_UNAUTHORIZED
        assert res_401.json() == {"message": "Invalid or expired session token"}

        # 429 Rate Limit
        res_429 = await client.get("/trigger-ratelimit")
        assert res_429.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert res_429.json() == {"message": "Exceeded maximum request threshold"}

        # 503 Dependency Failure
        res_503 = await client.get("/trigger-dependency")
        assert res_503.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert res_503.json() == {"message": "External cache service unreachable"}


@pytest.mark.asyncio
async def test_reorder_column_error_contract_compatibility(phase_g_app):
    """Verify column reorder route returns {'error': ...} to maintain frontend hook compatibility."""
    async with AsyncClient(transport=ASGITransport(app=phase_g_app), base_url="http://test") as client:
        res = await client.put("/api/columns/reorder")
        assert res.status_code == 400
        data = res.json()
        assert "error" in data
        assert data["error"] == "Invalid column sequence"
        assert "message" in data


@pytest.mark.asyncio
async def test_500_internal_server_error_sanitization_and_traceback_masking(phase_g_app, caplog):
    """Verify unexpected 500 errors log tracebacks server-side and never leak secrets to clients."""
    with caplog.at_level(logging.ERROR):
        async with AsyncClient(transport=ASGITransport(app=phase_g_app), base_url="http://test") as client:
            res = await client.get("/trigger-500")

    assert res.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    data = res.json()

    # Client payload is clean and generic
    assert data["message"] == "An unexpected internal server error occurred. Please try again later."
    assert "SuperSecretPass123" not in res.text
    assert "Traceback" not in res.text
    assert "X-Request-ID" in res.headers

    # Server log captured the exception
    assert any("Unhandled server exception" in record.message for record in caplog.records)


# ============================================================================
# 2. Request ID Generation, Validation & Duration Headers
# ============================================================================

@pytest.mark.asyncio
async def test_request_id_generation_and_process_time_header(phase_g_app):
    """Verify automatic UUID4 request ID generation and X-Process-Time measurement."""
    async with AsyncClient(transport=ASGITransport(app=phase_g_app), base_url="http://test") as client:
        res = await client.get("/trigger-not-found")

        # Headers present
        assert "X-Request-ID" in res.headers
        assert "X-Process-Time" in res.headers

        req_id = res.headers["X-Request-ID"]
        assert len(req_id) >= 10
        assert res.headers["X-Process-Time"].endswith("ms")


@pytest.mark.asyncio
async def test_client_supplied_request_id_validation_and_reuse(phase_g_app):
    """Verify valid client-supplied X-Request-ID is preserved and reflected back."""
    client_id = "req-client-trace-12345"
    async with AsyncClient(transport=ASGITransport(app=phase_g_app), base_url="http://test") as client:
        res = await client.get("/trigger-not-found", headers={"X-Request-ID": client_id})
        assert res.headers["X-Request-ID"] == client_id


@pytest.mark.asyncio
async def test_client_supplied_malicious_request_id_sanitization(phase_g_app):
    """Verify invalid or dangerous X-Request-ID values are discarded in favor of a safe UUID4."""
    malicious_id = "<script>alert('xss')</script>; DROP TABLE users;--"
    async with AsyncClient(transport=ASGITransport(app=phase_g_app), base_url="http://test") as client:
        res = await client.get("/trigger-not-found", headers={"X-Request-ID": malicious_id})
        safe_id = res.headers["X-Request-ID"]
        assert safe_id != malicious_id
        assert "<" not in safe_id
        assert "DROP" not in safe_id


# ============================================================================
# 3. Structured Logging & Sensitive Credential Redaction
# ============================================================================

def test_sensitive_string_redaction_masks_bearer_tokens_and_passwords():
    """Verify bearer tokens, passwords, and sensitive keys are masked in log strings."""
    raw_str = "User login attempt with Bearer eyJhbGciOiJIUzI1Ni.secret.token and password='SuperSecretPassword!'"
    masked = mask_sensitive_string(raw_str)
    assert "SuperSecretPassword!" not in masked
    assert "Bearer [REDACTED]" in masked
    assert "[REDACTED]" in masked


def test_sensitive_dict_redaction_masks_nested_credentials():
    """Verify nested dictionaries mask password, token, and secret fields recursively."""
    payload = {
        "username": "alice",
        "password": "MySecretPassword123",
        "nested": {
            "refresh_token": "rt_secure_token_abc",
            "safe_field": "visible_data",
        },
    }
    sanitized = mask_sensitive_data(payload)
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["username"] == "alice"
    assert sanitized["nested"]["refresh_token"] == "[REDACTED]"
    assert sanitized["nested"]["safe_field"] == "visible_data"


def test_logging_filter_scrubs_records():
    """Verify SensitiveDataFilter redacts log record messages and arguments."""
    log_filter = SensitiveDataFilter()
    record = logging.LogRecord(
        name="taskflow.test",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="Login with password=%s and token=%s",
        args=("PlainPassword", "raw_jwt_token_123"),
        exc_info=None,
    )
    log_filter.filter(record)
    assert "PlainPassword" not in record.msg
    assert "raw_jwt_token_123" not in record.msg
    assert "password=[REDACTED]" in record.msg
    assert "token=[REDACTED]" in record.msg


# ============================================================================
# 4. CORS Behavior (Allowed, Disallowed, Preflight, Exposed Headers)
# ============================================================================

@pytest.mark.asyncio
async def test_cors_allowed_origin_and_preflight_headers(phase_g_app):
    """Verify configured Next.js origin receives CORS headers and preflight approval."""
    async with AsyncClient(transport=ASGITransport(app=phase_g_app), base_url="http://test") as client:
        # Preflight OPTIONS request
        res_options = await client.options(
            "/trigger-not-found",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization,Content-Type",
            },
        )
        assert res_options.status_code == 200
        assert res_options.headers.get("access-control-allow-origin") == "http://localhost:3000"
        assert res_options.headers.get("access-control-allow-credentials") == "true"

        # Standard GET with Origin
        res_get = await client.get(
            "/trigger-not-found",
            headers={"Origin": "http://localhost:3000"},
        )
        assert res_get.headers.get("access-control-allow-origin") == "http://localhost:3000"
        expose_headers = res_get.headers.get("access-control-expose-headers", "")
        assert "X-Request-ID" in expose_headers
        assert "X-Process-Time" in expose_headers


@pytest.mark.asyncio
async def test_cors_disallows_unauthorized_origin(phase_g_app):
    """Verify unauthorized external origin does not receive CORS approval."""
    async with AsyncClient(transport=ASGITransport(app=phase_g_app), base_url="http://test") as client:
        res = await client.get(
            "/trigger-not-found",
            headers={"Origin": "http://unauthorized-malicious-site.com"},
        )
        assert res.headers.get("access-control-allow-origin") is None


# ============================================================================
# 5. Health Diagnostic Endpoint & Dependency Probing
# ============================================================================

@pytest.mark.asyncio
async def test_health_endpoint_probes_dependencies_without_exposing_secrets():
    """Verify /api/health probes dependencies, reports accurate status, and omits secrets."""
    async with AsyncClient(transport=ASGITransport(app=main_app), base_url="http://test") as client:
        res = await client.get("/api/health")
        assert res.status_code == 200
        data = res.json()

        # Contract keys present
        assert data["appName"] == "TaskFlow"
        assert data["apiHealth"] in ("operational", "degraded")
        assert data["status"] in ("healthy", "degraded")
        assert "uptimeSeconds" in data
        assert "dependencies" in data
        assert data["dependencies"]["database"] in ("connected", "disconnected")
        assert data["dependencies"]["redis"] in ("connected", "disconnected")

        # Zero actual secret credentials or connection URLs in payload
        assert settings.POSTGRES_PASSWORD not in res.text
        assert settings.JWT_SECRET not in res.text
        assert "postgresql://" not in res.text
        assert "redis://" not in res.text


# ============================================================================
# 6. Background Tasks Resilience & Exception Safety
# ============================================================================

@pytest.mark.asyncio
async def test_background_task_dispatches_with_serializable_identifiers(phase_g_app, caplog):
    """Verify background task runs with serializable primitives without blocking response."""
    with caplog.at_level(logging.INFO):
        async with AsyncClient(transport=ASGITransport(app=phase_g_app), base_url="http://test") as client:
            res = await client.post("/trigger-background")
            assert res.status_code == 200
            assert res.json() == {"status": "enqueued"}

    # Verified background task completed logging
    assert any("Background audit telemetry recorded" in record.message for record in caplog.records)


@pytest.mark.asyncio
async def test_background_task_exception_resilience_and_logging(caplog):
    """Verify exceptions inside background tasks are caught, logged, and do not crash."""
    with caplog.at_level(logging.ERROR):
        # Trigger notification with failing internal operation
        with patch("logging.Logger.info", side_effect=RuntimeError("Simulated background error")):
            await send_lightweight_notification(
                recipient_email="user@taskflow.dev",
                notification_type="AUDIT_ALERT",
                entity_id="task_123",
            )

    assert any("Failed to dispatch background notification" in record.message for record in caplog.records)
