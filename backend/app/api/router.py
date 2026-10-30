"""Central API routing configuration mounted under /api and /task_management/api/v1."""

from fastapi import APIRouter

from app.api.routers import (
    activities,
    auth,
    columns,
    dashboard,
    health,
    projects,
    tasks,
    users,
)

# 1. Core Router aggregating all domain-specific routers
core_router = APIRouter()
core_router.include_router(health.router)
core_router.include_router(auth.router)
core_router.include_router(columns.router)
core_router.include_router(projects.router)
core_router.include_router(tasks.router)
core_router.include_router(dashboard.router)
core_router.include_router(activities.router)
core_router.include_router(users.router)

# 2. Primary Router mounted under /api
api_router = APIRouter(prefix="/api")
api_router.include_router(core_router)

# 3. Transparent compatibility router mounted under /task_management/api/v1
task_management_router = APIRouter(prefix="/task_management/api/v1")
task_management_router.include_router(core_router)

# 4. Backward-compatible alias
v1_router = core_router
