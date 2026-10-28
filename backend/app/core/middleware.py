"""HTTP request tracking, duration measurement, and structured logging middleware."""

import logging
import re
import time
import uuid
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("taskflow.access")

# Safe Request ID regex: 1 to 64 alphanumeric characters, dashes, and underscores
SAFE_REQUEST_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


class RequestTrackingMiddleware(BaseHTTPMiddleware):
    """Generates/validates request IDs, measures execution duration, and outputs sanitized access logs."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 1. Request ID validation or generation using safe format
        incoming_request_id = request.headers.get("X-Request-ID")
        if incoming_request_id and SAFE_REQUEST_ID_REGEX.match(incoming_request_id):
            request_id = incoming_request_id
        else:
            request_id = str(uuid.uuid4())

        # Bind to request state for downstream handlers and exception formatters
        request.state.request_id = request_id

        # 2. Measure request execution duration
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            safe_route = request.url.path
            logger.exception(
                "Unhandled server exception: method=%s path=%s duration=%.2fms request_id=%s: %s",
                request.method,
                safe_route,
                duration_ms,
                request_id,
                exc,
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": safe_route,
                    "duration_ms": duration_ms,
                    "status_code": 500,
                },
            )
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=500,
                content={"message": "An unexpected internal server error occurred. Please try again later."},
                headers={"X-Request-ID": request_id, "X-Process-Time": f"{duration_ms:.2f}ms"},
            )

        duration_ms = (time.perf_counter() - start_time) * 1000

        # 3. Add response headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{duration_ms:.2f}ms"

        # 4. Structured access log (safely logging path without query parameters or credentials)
        safe_route = request.url.path
        status_code = response.status_code

        logger.info(
            "Request completed: method=%s path=%s status=%d duration=%.2fms request_id=%s",
            request.method,
            safe_route,
            status_code,
            duration_ms,
            request_id,
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": safe_route,
                "status_code": status_code,
                "duration_ms": duration_ms,
            },
        )

        return response
