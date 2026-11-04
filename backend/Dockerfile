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

# Copy dependency requirements
COPY requirements.txt ./

# Create virtualenv and install dependencies via uv
RUN uv venv /app/.venv && \
    uv pip install --no-cache -r requirements.txt


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
    useradd --system --uid 1001 --gid taskflow --create-home appuser

# Copy virtual environment from builder stage
COPY --from=builder /app/.venv /app/.venv

# Copy Alembic configuration, migrations, and FastAPI application source
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

# Set non-root ownership across application files
RUN chown -R appuser:taskflow /app

# Run container as non-root user
USER appuser

EXPOSE 8000

# Container health check querying application health endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/task_management/api/v1/health')" || exit 1

# Run migrations, seed idempotent baseline data, and start FastAPI via uvicorn ASGI server
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed.seed_data && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
