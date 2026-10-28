"""Unit tests for async database session lifecycle and transaction semantics."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models.user import User, UserRole


@pytest.mark.asyncio
async def test_expire_on_commit_false(db_session: AsyncSession):
    """Verify that expire_on_commit=False keeps model attributes accessible after commit."""
    user = User(
        id="user-expire-test",
        name="Expire Test",
        email="expire@test.com",
        role=UserRole.MEMBER,
    )
    db_session.add(user)
    await db_session.commit()

    # Accessing attributes after commit must NOT raise DetachedInstanceError
    assert user.id == "user-expire-test"
    assert user.name == "Expire Test"
    assert user.email == "expire@test.com"


@pytest.mark.asyncio
async def test_transaction_rollback_on_error(db_session: AsyncSession):
    """Verify that uncommitted transactions are rolled back properly upon exception."""
    user = User(
        id="user-rollback-test",
        name="Rollback Test",
        email="rollback@test.com",
        role=UserRole.MEMBER,
    )
    db_session.add(user)

    # Intentionally rollback
    await db_session.rollback()

    stmt = select(User).where(User.id == "user-rollback-test")
    result = await db_session.execute(stmt)
    assert result.scalar_one_or_none() is None
