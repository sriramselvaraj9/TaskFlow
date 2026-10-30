"""User security and activation tokens ORM model."""

import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TokenType(str, enum.Enum):
    """Categorization of ephemeral user verification tokens."""
    INVITE = "INVITE"


class UserToken(Base):
    """Security token storage entity for invitations, OTPs, and sessions."""

    __tablename__ = "user_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    token_type: Mapped[TokenType] = mapped_column(
        Enum(TokenType, name="token_type", native_enum=False),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
