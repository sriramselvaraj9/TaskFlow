"""Task request, update, response, and filter schemas."""

from datetime import date, datetime
from typing import Any, List, Literal, Optional, Union
from pydantic import Field, field_validator, model_validator

from app.schemas.common import CamelModel


class TaskBase(CamelModel):
    """Base fields common across Task schemas."""

    title: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=3, max_length=2000)
    project_id: str = Field(..., min_length=1)
    status: str = Field(default="TODO")
    priority: Literal["LOW", "MEDIUM", "HIGH"] = Field(default="MEDIUM")
    assignee_id: Optional[str] = Field(default=None)
    start_date: Optional[Union[date, str]] = Field(default=None)
    due_date: Union[date, str] = Field(...)
    tags: List[str] = Field(default_factory=list)


class TaskCreate(TaskBase):
    """Payload to create a new task with date validation."""

    @model_validator(mode="after")
    def validate_dates(self) -> "TaskCreate":
        if self.start_date and self.due_date:
            try:
                start = self.start_date if isinstance(self.start_date, date) else date.fromisoformat(str(self.start_date).split("T")[0])
                due = self.due_date if isinstance(self.due_date, date) else date.fromisoformat(str(self.due_date).split("T")[0])
                if start > due:
                    raise ValueError("Start date cannot be after due date")
            except ValueError as e:
                if "Start date cannot be after due date" in str(e):
                    raise
                # Allow flexible string formats if already validated
        return self


class TaskUpdate(CamelModel):
    """Payload to update an existing task."""

    title: Optional[str] = Field(default=None, min_length=3, max_length=100)
    description: Optional[str] = Field(default=None, min_length=3, max_length=2000)
    status: Optional[str] = None
    priority: Optional[Literal["LOW", "MEDIUM", "HIGH"]] = None
    assignee_id: Optional[str] = None
    start_date: Optional[Union[date, str]] = None
    due_date: Optional[Union[date, str]] = None
    tags: Optional[List[str]] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "TaskUpdate":
        if self.start_date and self.due_date:
            try:
                start = self.start_date if isinstance(self.start_date, date) else date.fromisoformat(str(self.start_date).split("T")[0])
                due = self.due_date if isinstance(self.due_date, date) else date.fromisoformat(str(self.due_date).split("T")[0])
                if start > due:
                    raise ValueError("Start date cannot be after due date")
            except ValueError as e:
                if "Start date cannot be after due date" in str(e):
                    raise
        return self


class TaskResponse(CamelModel):
    """Complete Task representation matching frontend contracts."""

    id: str
    title: str
    description: str
    project_id: str
    status: str
    priority: Literal["LOW", "MEDIUM", "HIGH"]
    assignee_id: Optional[str] = None
    start_date: Optional[Union[date, str]] = None
    due_date: Union[date, str]
    tags: List[str] = Field(default_factory=list)
    created_by_id: str
    created_at: Union[datetime, str]
    updated_at: Union[datetime, str]

    @field_validator("tags", mode="before")
    @classmethod
    def default_tags(cls, v: Any) -> List[str]:
        if v is None:
            return []
        return v


class TaskFilterParams(CamelModel):
    """Filter parameters accepted by the GET /api/tasks endpoint."""

    project_id: Optional[str] = None
    status: Optional[str] = "ALL"
    priority: Optional[str] = "ALL"
    assignee_id: Optional[str] = "ALL"
    search: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None

