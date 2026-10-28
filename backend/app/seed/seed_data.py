"""Deterministic and idempotent development database seed script."""

import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.column import BoardColumn
from app.models.user import User, UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("taskflow.seed")

# Bcrypt hash for "AdminPass@2026"
ADMIN_HASH = "$2a$08$6MLZwjUPsb.ljnT0PQ02oO9pNhfd.GWctFYTvlldkj/8W19eP4Lyu"
# Bcrypt hash for "MemberPass@2026"
MEMBER_HASH = "$2a$08$HFVFArhqzFozzjQiwG3seepzIYNCq.r1pfXdcJV90ZtAr93vgjaGe"

SEED_COLUMNS = [
    {
        "id": "TODO",
        "title": "TODO",
        "dot_color": "bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]",
        "accent_color": "border-slate-900",
        "order": 0,
    },
    {
        "id": "IN_PROGRESS",
        "title": "In Progress",
        "dot_color": "bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]",
        "accent_color": "border-slate-900",
        "order": 1,
    },
    {
        "id": "IN_REVIEW",
        "title": "In Review",
        "dot_color": "bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]",
        "accent_color": "border-slate-900",
        "order": 2,
    },
    {
        "id": "DONE",
        "title": "Done",
        "dot_color": "bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.6)]",
        "accent_color": "border-slate-900",
        "order": 3,
    },
]

SEED_USERS = [
    {
        "id": "user-admin-1",
        "name": "Sriram S",
        "email": "sriramccbp@gmail.com",
        "role": UserRole.ADMIN,
        "designation": "Lead Administrator",
        "password_hash": ADMIN_HASH,
    },
    {
        "id": "user-admin-2",
        "name": "Admin User",
        "email": "admin@gmail.com",
        "role": UserRole.ADMIN,
        "designation": "System Administrator",
        "password_hash": ADMIN_HASH,
    },
    {
        "id": "user-member-1",
        "name": "Member User",
        "email": "member@gmail.com",
        "role": UserRole.MEMBER,
        "designation": "Software Engineer",
        "password_hash": MEMBER_HASH,
    },
]


async def seed_columns(session: AsyncSession) -> int:
    """Idempotently seeds default Kanban board columns."""
    created_count = 0
    for col_data in SEED_COLUMNS:
        stmt = select(BoardColumn).where(BoardColumn.id == col_data["id"])
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if not existing:
            new_col = BoardColumn(
                id=col_data["id"],
                title=col_data["title"],
                dot_color=col_data["dot_color"],
                accent_color=col_data["accent_color"],
                order=col_data["order"],
            )
            session.add(new_col)
            created_count += 1
            logger.info("Seeded board column: %s (%s)", col_data["title"], col_data["id"])

    return created_count


async def seed_users(session: AsyncSession) -> int:
    """Idempotently seeds baseline Admin and Member accounts."""
    created_count = 0
    for user_data in SEED_USERS:
        stmt = select(User).where(User.email == user_data["email"])
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if not existing:
            new_user = User(
                id=user_data["id"],
                name=user_data["name"],
                email=user_data["email"],
                role=user_data["role"],
                designation=user_data["designation"],
                password_hash=user_data["password_hash"],
            )
            session.add(new_user)
            created_count += 1
            logger.info("Seeded user account: %s (%s)", user_data["email"], user_data["role"].value)

    return created_count


async def run_seed(session: AsyncSession) -> None:
    """Executes all seed tasks inside a safe transactional boundary."""
    cols_added = await seed_columns(session)
    users_added = await seed_users(session)
    await session.commit()
    logger.info("Seed execution complete: %d columns added, %d users added.", cols_added, users_added)


async def main() -> None:
    """Entry point for standalone execution."""
    async with AsyncSessionLocal() as session:
        await run_seed(session)


if __name__ == "__main__":
    asyncio.run(main())
