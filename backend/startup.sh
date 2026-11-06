#!/bin/sh

set -e

echo "=================================================="
echo " Starting TaskFlow Backend Service"
echo "=================================================="

# Stage 1: Pre-deployment Verification (Environment Configuration)
echo "[1/5] Executing pre-deployment verification..."
sh /app/pre_deployment.sh

# Stage 2: Database Migrations
echo "[2/5] Running database migrations..."
alembic upgrade head

# Stage 3: Database Seeding
echo "[3/5] Seeding baseline database records..."
python -m app.seed.seed_data

# Stage 4: Pytest Suite Execution
echo "[4/5] Executing automated test suite..."
pytest

# Stage 5: Start FastAPI Application Server via Uvicorn
echo "[5/5] Starting FastAPI application via Uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
