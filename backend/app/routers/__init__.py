"""Application Routers package containing modular FastAPI APIRouter instances."""

from fastapi import APIRouter

from app.core.config import settings
from app.routers import (
    activities,
    auth,
    columns,
    dashboard,
    health,
    projects,
    tasks,
    users,
)

# Core Router aggregating all domain-specific routers
core_router = APIRouter()
core_router.include_router(health.router)
core_router.include_router(auth.router)
core_router.include_router(columns.router)
core_router.include_router(projects.router)
core_router.include_router(tasks.router)
core_router.include_router(dashboard.router)
core_router.include_router(activities.router)
core_router.include_router(users.router)

# Centralized API Router mounted strictly under settings.API_V1_STR (/task_management/api/v1)
api_router = APIRouter(prefix=settings.API_V1_STR)
api_router.include_router(core_router)

# Backward-compatible aliases pointing to the canonical api_router
task_management_router = api_router
v1_router = api_router

__all__ = [
    "activities",
    "auth",
    "columns",
    "dashboard",
    "health",
    "projects",
    "tasks",
    "users",
    "core_router",
    "api_router",
    "task_management_router",
    "v1_router",
]
