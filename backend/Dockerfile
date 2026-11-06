# ==========================================
# TaskFlow FastAPI Backend Dockerfile
# Multi-stage optimized build using uv
# ==========================================

# Stage 1: Build & Dependencies using uv
FROM python:3.12-slim-bookworm AS builder

# Install uv from official Astral binary image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Enable bytecode compilation and copy mode
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Install compilation tools for binary extension wheels if needed
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY pyproject.toml uv.lock ./

# Install all dependencies (including pytest/test dependencies for in-container testing) via uv sync
RUN uv sync --frozen --no-install-project


# Stage 2: Production Runtime
FROM python:3.12-slim-bookworm AS runner 

WORKDIR /app

# Configure Python runtime environment
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    HOST="0.0.0.0"

# Create a non-root system user and group for security
RUN groupadd --system --gid 1001 taskflow && \
    useradd --system --uid 1001 --gid taskflow --create-home appuser && \
    chown appuser:taskflow /app

# Copy virtual environment from builder stage
COPY --from=builder --chown=appuser:taskflow /app/.venv /app/.venv

# Copy Alembic configuration, migrations, and FastAPI application source
COPY --chown=appuser:taskflow alembic.ini ./
COPY --chown=appuser:taskflow alembic ./alembic
COPY --chown=appuser:taskflow app ./app

# Copy pytest configuration and test suite
COPY --chown=appuser:taskflow pytest.ini ./
COPY --chown=appuser:taskflow tests ./tests

# Copy startup and pre-deployment scripts
COPY --chown=appuser:taskflow startup.sh ./startup.sh
COPY --chown=appuser:taskflow pre_deployment.sh ./pre_deployment.sh

# Set executable permissions for shell scripts
RUN chmod +x /app/startup.sh /app/pre_deployment.sh

# Run container as non-root user
USER appuser

EXPOSE 8000

# Container health check querying application health endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/task_management/api/v1/health')" || exit 1

# Execute startup orchestrator script
CMD ["sh", "/app/startup.sh"]
