"""Central API routing configuration mounted under /api and /task_management/api/v1.

Re-exported from app.routers for backward-compatibility.
"""

from app.routers import (
    activities,
    api_router,
    auth,
    columns,
    core_router,
    dashboard,
    health,
    projects,
    task_management_router,
    tasks,
    users,
    v1_router,
)

__all__ = [
    "activities",
    "api_router",
    "auth",
    "columns",
    "core_router",
    "dashboard",
    "health",
    "projects",
    "task_management_router",
    "tasks",
    "users",
    "v1_router",
]
