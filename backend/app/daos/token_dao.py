"""Security and verification token Data Access Object."""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.daos.base import BaseDAO
from app.models.token import TokenType, UserToken


class TokenDAO(BaseDAO[UserToken]):
    """DAO for managing ephemeral tokens (invitations and password resets)."""

    def __init__(self) -> None:
        super().__init__(UserToken)

    async def create_token(
        self,
        session: AsyncSession,
        email: str,
        token_type: TokenType,
        token_hash: str,
        expires_at: datetime,
    ) -> UserToken:
        """Store a new verification or session token."""
        token = UserToken(
            email=email.strip().lower(),
            token_type=token_type,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        session.add(token)
        await session.flush()
        return token

    async def get_valid_token(
        self,
        session: AsyncSession,
        email: str,
        token_type: TokenType,
        token_hash: str,
    ) -> Optional[UserToken]:
        """Find an unexpired, unconsumed token."""
        now = datetime.now(timezone.utc)
        stmt = select(UserToken).where(
            UserToken.email == email.strip().lower(),
            UserToken.token_type == token_type,
            UserToken.token_hash == token_hash,
            UserToken.consumed_at.is_(None),
            UserToken.expires_at > now,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def consume_token(
        self,
        session: AsyncSession,
        token_id: int,
    ) -> None:
        """Mark a token as consumed."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(UserToken)
            .where(UserToken.id == token_id)
            .values(consumed_at=now)
        )
        await session.execute(stmt)
        await session.flush()

    async def invalidate_tokens_for_email(
        self,
        session: AsyncSession,
        email: str,
        token_type: TokenType,
    ) -> None:
        """Mark all unconsumed tokens of a given type as consumed."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(UserToken)
            .where(
                UserToken.email == email.strip().lower(),
                UserToken.token_type == token_type,
                UserToken.consumed_at.is_(None),
            )
            .values(consumed_at=now)
        )
        await session.execute(stmt)
        await session.flush()


token_dao = TokenDAO()
