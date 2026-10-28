"""TaskFlow FastAPI application entrypoint."""

from contextlib import asynccontextmanager
import logging
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import register_exception_handlers
from app.core.logging_config import setup_logging
from app.core.middleware import RequestTrackingMiddleware
from app.core.redis import close_redis_client, init_redis_client

# Initialize centralized logging and sensitive data sanitization filter
setup_logging()
logger = logging.getLogger("taskflow.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown hooks."""
    # 1. Startup: Initialize Redis connection and verify database connectivity
    try:
        await init_redis_client()
    except Exception as exc:
        logger.warning("Failed to initialize Redis client on startup: %s", exc)

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection successfully established on startup")
    except Exception as exc:
        logger.warning("Database connection check failed on startup: %s", exc)

    yield

    # 2. Shutdown: Dispose database connection pool and close Redis client
    await engine.dispose()
    await close_redis_client()
    logger.info("Database engine pool disposed and Redis connection closed successfully")


def create_app() -> FastAPI:
    """Application factory for TaskFlow backend."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
        lifespan=lifespan,
    )

    # 1. Request ID tracking, duration measurement, and sanitized logging middleware
    app.add_middleware(RequestTrackingMiddleware)

    # 2. CORS configuration for frontend interaction with explicitly defined methods and headers
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=settings.CORS_ALLOWED_METHODS,
        allow_headers=settings.CORS_ALLOWED_HEADERS,
        expose_headers=["X-Request-ID", "X-Process-Time"],
    )

    # 3. Centralized exception handlers for uniform JSON error responses
    register_exception_handlers(app)

    # 4. Register central API router (/api)
    app.include_router(api_router)

    return app


app = create_app()

