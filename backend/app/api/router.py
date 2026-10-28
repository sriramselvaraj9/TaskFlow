"""Central API routing configuration mounted under /api."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    activities,
    auth,
    columns,
    dashboard,
    health,
    projects,
    tasks,
    users,
)

# 1. Core v1 Sub-Router (Routes inside Routes)
v1_router = APIRouter()
v1_router.include_router(health.router)
v1_router.include_router(auth.router)
v1_router.include_router(columns.router)
v1_router.include_router(projects.router)
v1_router.include_router(tasks.router)
v1_router.include_router(dashboard.router)
v1_router.include_router(activities.router)
v1_router.include_router(users.router)

# 2. Primary Router mounted under /api
api_router = APIRouter(prefix="/api")
api_router.include_router(v1_router)



