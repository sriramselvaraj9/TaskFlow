"""API Routers package containing modular FastAPI APIRouter instances."""

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

__all__ = [
    "activities",
    "auth",
    "columns",
    "dashboard",
    "health",
    "projects",
    "tasks",
    "users",
]
