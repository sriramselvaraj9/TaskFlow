"""Unit tests for centralized configuration and settings validation."""

from app.core.config import Settings


def test_default_settings():
    """Verify default settings instantiation and fallbacks."""
    settings = Settings()
    assert settings.APP_NAME == "TaskFlow"
    assert settings.APP_VERSION == "0.1.1"
    assert settings.ENVIRONMENT in ["development", "staging", "production", "testing"]
    assert settings.DB_POOL_PRE_PING is True
    assert settings.DB_EXPIRE_ON_COMMIT is False
    assert "postgresql+asyncpg://" in str(settings.DATABASE_URL)


def test_database_url_custom_assembly():
    """Verify dynamic DATABASE_URL assembly from explicit database parameters."""
    settings = Settings(
        POSTGRES_USER="custom_user",
        POSTGRES_PASSWORD="custom_password",
        POSTGRES_SERVER="db.internal.net",
        POSTGRES_PORT=5433,
        POSTGRES_DB="custom_taskflow",
        _env_file=None,
    )
    expected_url = "postgresql+asyncpg://custom_user:custom_password@db.internal.net:5433/custom_taskflow"
    assert str(settings.DATABASE_URL) == expected_url



def test_explicit_database_url_override():
    """Verify that an explicit DATABASE_URL is preserved without modification."""
    explicit_url = "postgresql+asyncpg://override_user:override_pass@primary.db:5432/override_db"
    settings = Settings(DATABASE_URL=explicit_url)
    assert str(settings.DATABASE_URL) == explicit_url


def test_cors_origins_parsing():
    """Verify parsing of CORS origins from comma-delimited string and list."""
    # List format
    settings_list = Settings(CORS_ORIGINS=["https://app.taskflow.dev", "https://staging.taskflow.dev"])
    assert len(settings_list.CORS_ORIGINS) == 2
    assert "https://app.taskflow.dev" in settings_list.CORS_ORIGINS

    # Comma-delimited string format
    settings_str = Settings(CORS_ORIGINS="https://app.taskflow.dev, https://staging.taskflow.dev")
    assert len(settings_str.CORS_ORIGINS) == 2
    assert "https://app.taskflow.dev" in settings_str.CORS_ORIGINS
    assert "https://staging.taskflow.dev" in settings_str.CORS_ORIGINS
