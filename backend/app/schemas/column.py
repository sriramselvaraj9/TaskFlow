"""Board Column request and response schemas."""

from datetime import datetime
from typing import List, Optional, Union
from pydantic import Field

from app.schemas.common import CamelModel


class ColumnBase(CamelModel):
    """Base board column schema."""

    title: str = Field(..., min_length=2, max_length=30)
    dot_color: Optional[str] = Field(
        default="bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]",
        max_length=100,
    )
    accent_color: Optional[str] = Field(default="border-slate-900", max_length=100)


class ColumnCreate(ColumnBase):
    """Payload to add a new workflow column."""

    pass


class ColumnReorder(CamelModel):
    """Payload to update relative column order."""

    column_ids: List[str] = Field(..., min_length=1)


class ColumnResponse(ColumnBase):
    """Board column response matching frontend expectations."""

    id: str
    order: int
    created_at: Union[datetime, str]


class ColumnDeleteResponse(CamelModel):
    """Response returned when deleting a column with task migration."""

    message: str
    moved_tasks_count: int
    deleted_column: ColumnResponse
