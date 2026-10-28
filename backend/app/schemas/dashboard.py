"""Dashboard statistics and telemetry schemas."""

from typing import Dict
from pydantic import Field

from app.schemas.common import CamelModel


class DashboardStatsResponse(CamelModel):
    """Aggregated workspace statistics for dashboard telemetry."""

    total_tasks: int = Field(default=0)
    completed_tasks: int = Field(default=0)
    in_progress_tasks: int = Field(default=0)
    overdue_tasks: int = Field(default=0)
    overdue_count: int = Field(default=0)
    assigned_to_me: int = Field(default=0)
    active_projects: int = Field(default=0)
    completion_rate: int = Field(default=0)
    tasks_by_status: Dict[str, int] = Field(default_factory=dict)
    tasks_by_priority: Dict[str, int] = Field(default_factory=dict)
