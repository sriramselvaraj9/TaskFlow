"""Activity log response schema."""

from datetime import datetime
from typing import Optional, Union
from app.models.activity import ActivityAction
from app.models.user import UserRole
from app.schemas.common import CamelModel


class ActivityLogResponse(CamelModel):
    """Activity audit trail record matching frontend contract."""

    id: str
    action: ActivityAction
    details: str
    user_id: str
    user_name: str
    user_role: UserRole
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    timestamp: Union[datetime, str]
