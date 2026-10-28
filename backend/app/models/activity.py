"""Activity audit log ORM model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class ActivityAction(str, enum.Enum):
    """Categorization of workspace events for audit trails."""
    TASK_CREATED = "TASK_CREATED"
    TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED"
    TASK_UPDATED = "TASK_UPDATED"
    TASK_DELETED = "TASK_DELETED"
    PROJECT_CREATED = "PROJECT_CREATED"
    MEMBER_ASSIGNED = "MEMBER_ASSIGNED"
    COLUMN_CREATED = "COLUMN_CREATED"
    COLUMN_DELETED = "COLUMN_DELETED"


class ActivityLog(Base):
    """Activity audit trail record."""

    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    action: Mapped[ActivityAction] = mapped_column(
        Enum(ActivityAction, name="activity_action", native_enum=False),
        nullable=False,
    )
    details: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_name: Mapped[str] = mapped_column(String(100), nullable=False)
    user_role: Mapped[str] = mapped_column(String(20), nullable=False)
    project_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )
    task_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="activities")
