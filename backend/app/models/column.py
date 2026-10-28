"""Board Column ORM model."""

from datetime import datetime
from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BoardColumn(Base):
    """Kanban board workflow column state."""

    __tablename__ = "board_columns"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    dot_color: Mapped[str] = mapped_column(
        String(100),
        default="bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]",
        nullable=False,
    )
    accent_color: Mapped[str] = mapped_column(
        String(100),
        default="border-slate-900",
        nullable=False,
    )
    order: Mapped[int] = mapped_column(Integer, default=0, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
