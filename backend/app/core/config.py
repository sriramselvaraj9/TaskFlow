"""Centralized application settings using Pydantic Settings."""

from typing import List, Literal, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration and environment variable validator."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Core Application Telemetry
    APP_NAME: str = "TaskFlow"
    APP_VERSION: str = "0.1.1"
    ENVIRONMENT: Literal["development", "staging", "production", "testing"] = "development"
    DEBUG: bool = False
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    API_V1_STR: str = "/task_management/api/v1"

    # Frontend Canonical URL & CORS
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://localhost:3002",
    ]
    CORS_ALLOWED_METHODS: List[str] = [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
        "HEAD",
    ]
    CORS_ALLOWED_HEADERS: List[str] = [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "Accept",
        "Origin",
        "x-user-id",
        "x-user-name",
        "x-user-role",
        "x-user-email",
    ]

    # Database Configuration (PostgreSQL Async via asyncpg)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "taskflow_db"
    DATABASE_URL: Optional[str] = None

    # Connection Pool Settings
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_PRE_PING: bool = True
    DB_ECHO: bool = False
    DB_EXPIRE_ON_COMMIT: bool = False

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info) -> str:
        """Assembles postgresql+asyncpg URL if not explicitly supplied, normalizing cloud prefixes."""
        if isinstance(v, str) and v.strip():
            url = v.strip()
            # Normalize cloud provider URL schemes (e.g. Render, Heroku, Neon) to asyncpg
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        data = info.data
        user = data.get("POSTGRES_USER", "postgres")
        password = data.get("POSTGRES_PASSWORD", "password")
        server = data.get("POSTGRES_SERVER", "localhost")
        port = data.get("POSTGRES_PORT", 5432)
        db_name = data.get("POSTGRES_DB", "taskflow_db")
        return f"postgresql+asyncpg://{user}:{password}@{server}:{port}/{db_name}"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Parses comma-separated string, JSON string, or list of CORS origins."""
        if isinstance(v, str):
            v_trimmed = v.strip()
            if v_trimmed.startswith("[") and v_trimmed.endswith("]"):
                import json
                try:
                    parsed = json.loads(v_trimmed)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in v_trimmed.split(",") if origin.strip()]
        if isinstance(v, list):
            return v
        return ["http://localhost:3000"]

    # Security & Tokens
    JWT_SECRET: str = "taskflow-super-secure-production-secret-key-32chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    INVITE_TOKEN_EXPIRE_DAYS: int = 7
    OTP_EXPIRE_MINUTES: int = 10
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 300

    # Redis Cache & Sessions (Prepared for subsequent phase)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0
    REDIS_URL: Optional[str] = None
    REDIS_TIMEOUT_MS: int = 500

    # Cache & Performance Configuration (Phase F)
    CACHE_ENABLED: bool = True
    CACHE_KEY_PREFIX: str = "taskflow:cache"
    CACHE_TTL_DASHBOARD: int = 60
    CACHE_TTL_ANALYTICS: int = 180
    CACHE_TTL_TASKS: int = 30
    CACHE_TTL_PROJECTS: int = 60
    CACHE_TTL_COLUMNS: int = 300
    CACHE_TTL_ACTIVITIES: int = 60
    CACHE_TTL_USERS: int = 60


    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def assemble_redis_connection(cls, v: Optional[str], info) -> str:
        if isinstance(v, str) and v.strip():
            return v.strip()
        data = info.data
        host = data.get("REDIS_HOST", "localhost")
        port = data.get("REDIS_PORT", 6379)
        db = data.get("REDIS_DB", 0)
        password = data.get("REDIS_PASSWORD")
        auth = f":{password}@" if password else ""
        return f"redis://{auth}{host}:{port}/{db}"

    # Email Dispatcher Settings
    BREVO_API_KEY: Optional[str] = None
    BREVO_USER: Optional[str] = None
    BREVO_FROM: str = '"TaskFlow Admin" <sriramccbp@gmail.com>'

    BREVO_SMTP_HOST: str = "smtp-relay.brevo.com"
    BREVO_SMTP_PORT: int = 587
    BREVO_SMTP_USER: Optional[str] = None
    BREVO_SMTP_KEY: Optional[str] = None
    BREVO_SENDER_EMAIL: str = "sriramccbp@gmail.com"

    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    SMTP_FROM: Optional[str] = None
    SMTP_SECURE: bool = False


# Global singleton settings instance
settings = Settings()
