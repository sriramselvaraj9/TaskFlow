"""Unit tests for deterministic and idempotent seed execution."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.column import BoardColumn
from app.models.user import User
from app.seed.seed_data import run_seed


@pytest.mark.asyncio
async def test_deterministic_seed_execution(db_session: AsyncSession):
    """Verify that run_seed seeds default columns and users."""
    await run_seed(db_session)

    # Verify columns were created
    cols_result = await db_session.execute(select(BoardColumn))
    cols = cols_result.scalars().all()
    assert len(cols) == 4
    col_ids = {c.id for c in cols}
    assert {"TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"}.issubset(col_ids)

    # Verify seed users were created
    users_result = await db_session.execute(select(User))
    users = users_result.scalars().all()
    assert len(users) == 3
    user_emails = {u.email for u in users}
    assert "admin@gmail.com" in user_emails
    assert "member@gmail.com" in user_emails
    assert "sriramccbp@gmail.com" in user_emails


@pytest.mark.asyncio
async def test_seed_idempotency(db_session: AsyncSession):
    """Verify that running run_seed multiple times is strictly idempotent."""
    # First execution
    await run_seed(db_session)

    # Second execution must execute without error and without duplicating entities
    await run_seed(db_session)

    cols_result = await db_session.execute(select(BoardColumn))
    assert len(cols_result.scalars().all()) == 4

    users_result = await db_session.execute(select(User))
    assert len(users_result.scalars().all()) == 3
