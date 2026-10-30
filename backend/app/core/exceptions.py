import logging
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("taskflow.exceptions")


class TaskFlowException(Exception):
    """Base domain exception for TaskFlow."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundException(TaskFlowException):
    """Raised when a requested resource does not exist."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message=message, status_code=status.HTTP_404_NOT_FOUND)


class ValidationException(TaskFlowException):
    """Raised when business logic validation fails."""

    def __init__(self, message: str = "Validation failed"):
        super().__init__(message=message, status_code=status.HTTP_400_BAD_REQUEST)


class WorkflowRestrictionException(TaskFlowException):
    """Raised when task status transition violates sequential workflow."""

    def __init__(self, message: str):
        super().__init__(message=message, status_code=status.HTTP_400_BAD_REQUEST)


class ConflictException(TaskFlowException):
    """Raised when an entity uniqueness constraint is violated."""

    def __init__(self, message: str = "Resource conflict", status_code: int = status.HTTP_409_CONFLICT):
        super().__init__(message=message, status_code=status_code)


class PermissionDeniedException(TaskFlowException):
    """Raised when user lacks required role/authorization."""

    def __init__(self, message: str = "Unauthorized: Access denied"):
        super().__init__(message=message, status_code=status.HTTP_403_FORBIDDEN)


class AuthenticationException(TaskFlowException):
    """Raised when user is unauthenticated or token is invalid."""

    def __init__(self, message: str = "Unauthorized. Please log in."):
        super().__init__(message=message, status_code=status.HTTP_401_UNAUTHORIZED)


class RateLimitException(TaskFlowException):
    """Raised when a client exceeds configured rate limit thresholds."""

    def __init__(self, message: str = "Too many requests. Please try again later."):
        super().__init__(message=message, status_code=status.HTTP_429_TOO_MANY_REQUESTS)


class DependencyFailureException(TaskFlowException):
    """Raised when an external dependency (database, Redis, external service) is unavailable."""

    def __init__(self, message: str = "Service dependency temporarily unavailable"):
        super().__init__(message=message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)


def register_exception_handlers(app: FastAPI) -> None:
    """Registers centralized domain exception translators with FastAPI."""

    @app.exception_handler(TaskFlowException)
    async def taskflow_exception_handler(request: Request, exc: TaskFlowException):
        request_id = getattr(request.state, "request_id", None)
        headers = {"X-Request-ID": request_id} if request_id else None

        # Column reorder route specifically expects {"error": ...}
        if "reorder" in request.url.path:
            return JSONResponse(
                status_code=exc.status_code,
                content={"error": exc.message, "message": exc.message},
                headers=headers,
            )
        return JSONResponse(
            status_code=exc.status_code,
            content={"message": exc.message},
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        request_id = getattr(request.state, "request_id", None)
        headers = {"X-Request-ID": request_id} if request_id else None

        # Format Pydantic errors to match frontend Zod parser expectations
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "message": "Validation Error",
                "errors": exc.errors(),
            },
            headers=headers,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        request_id = getattr(request.state, "request_id", None)
        headers = {"X-Request-ID": request_id} if request_id else None

        return JSONResponse(
            status_code=exc.status_code,
            content={"message": str(exc.detail)},
            headers=headers,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", None)
        headers = {"X-Request-ID": request_id} if request_id else None

        # Log unexpected internal server errors with server-side traceback
        logger.exception(
            "Unhandled server exception processing %s %s [request_id=%s]: %s",
            request.method,
            request.url.path,
            request_id or "unknown",
            exc,
        )

        # Return sanitized error response without leaking tracebacks, db credentials or secrets
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "An unexpected internal server error occurred. Please try again later."},
            headers=headers,
        )

