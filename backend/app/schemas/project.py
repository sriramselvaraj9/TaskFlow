"""Project request and response schemas."""

from datetime import datetime
from typing import Any, List, Literal, Optional, Union
from pydantic import Field, model_validator

from app.schemas.common import CamelModel


class ProjectBase(CamelModel):
    """Base project schema matching frontend validation."""

    name: str = Field(..., min_length=3, max_length=60)
    key: Optional[str] = Field(default="", max_length=10)
    description: Optional[str] = Field(default="", max_length=2000)
    status: Literal["ACTIVE", "ARCHIVED", "COMPLETED"] = Field(default="ACTIVE")


class ProjectCreate(CamelModel):
    """Payload for creating a new project."""

    name: str = Field(..., min_length=3, max_length=60)
    key: Optional[str] = Field(default="", max_length=10)
    description: Optional[str] = Field(default="", max_length=2000)
    member_ids: List[str] = Field(default_factory=list)


class ProjectUpdate(CamelModel):
    """Payload for partial project settings update."""

    name: Optional[str] = Field(default=None, min_length=3, max_length=60)
    description: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[Literal["ACTIVE", "ARCHIVED", "COMPLETED"]] = None
    member_ids: Optional[List[str]] = None


class ProjectResponse(CamelModel):
    """Complete project entity response."""

    id: str
    name: str
    key: str
    description: Optional[str] = Field(default="")
    status: Literal["ACTIVE", "ARCHIVED", "COMPLETED"]
    owner_id: str
    member_ids: List[str] = Field(default_factory=list)
    created_at: Union[datetime, str]
    updated_at: Union[datetime, str]

    @model_validator(mode="before")
    @classmethod
    def populate_member_ids(cls, data: Any) -> Any:
        """Extract member IDs if reading from ORM project model with members relationship."""
        if hasattr(data, "members") and not hasattr(data, "member_ids"):
            # If ORM model, build a dict or dynamic proxy
            members = getattr(data, "members", [])
            return {
                "id": data.id,
                "name": data.name,
                "key": data.key,
                "description": data.description,
                "status": data.status.value if hasattr(data.status, "value") else str(data.status),
                "owner_id": data.owner_id,
                "member_ids": [m.id for m in members if hasattr(m, "id")],
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        return data
