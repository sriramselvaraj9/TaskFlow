"""Common base schemas, camelCase serialization, and utility models."""

from datetime import date, datetime
import re
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, field_serializer


def to_camel(snake_str: str) -> str:
    """Converts snake_case field names to camelCase for frontend compatibility."""
    components = snake_str.split("_")
    return components[0] + "".join(x.capitalize() for x in components[1:])


class CamelModel(BaseModel):
    """Base Pydantic v2 model configured for frontend camelCase JSON contracts."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        arbitrary_types_allowed=True,
    )

    @field_serializer("*", mode="wrap")
    @classmethod
    def serialize_dates(cls, v: Any, nxt: Any) -> Any:
        """Serializes datetime and date objects to standard ISO 8601 strings."""
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        return nxt(v)


class MessageResponse(CamelModel):
    """Generic message response wrapper matching frontend expectations."""

    message: str
    error: Optional[str] = None
