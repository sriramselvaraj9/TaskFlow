"""Application Routers package containing modular FastAPI APIRouter instances."""

from fastapi import APIRouter

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

# 1. Primary Router mounted under /api
api_router = APIRouter(prefix="/api")
api_router.include_router(core_router)

# 2. Compatibility Router mounted under /task_management/api/v1
task_management_router = APIRouter(prefix="/task_management/api/v1")
task_management_router.include_router(core_router)

# Backward-compatible alias
v1_router = core_router

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
