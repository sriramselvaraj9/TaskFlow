"""Database prestart migrations compatibility check.

Automatically bridges legacy migrations (001_initial_schema) to the
split 4-part migrations (004_activities) on deployed environments.
"""

import asyncio
import logging
from sqlalchemy import text
from app.core.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("taskflow.prestart")


async def check_and_sync_alembic_version() -> None:
    """Ensures deployed databases with legacy 001_initial_schema revision

    are seamlessly mapped to 004_activities before alembic upgrade runs.
    """
    logger.info("Running prestart migration compatibility check...")
    try:
        async with engine.begin() as conn:
            # Check if alembic_version table exists
            check_query = text(
                "SELECT EXISTS ("
                "  SELECT 1 FROM information_schema.tables "
                "  WHERE table_name = 'alembic_version'"
                ")"
            )
            table_exists = (await conn.execute(check_query)).scalar()
            if not table_exists:
                logger.info("alembic_version table not found yet. Skipping check.")
                return

            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            rows = [row[0] for row in result.fetchall()]
            logger.info(f"Current DB revision(s) in alembic_version: {rows}")

            if "001_initial_schema" in rows:
                logger.info("Found legacy revision '001_initial_schema'. Upgrading to '004_activities'...")
                await conn.execute(
                    text(
                        "UPDATE alembic_version "
                        "SET version_num = '004_activities' "
                        "WHERE version_num = '001_initial_schema'"
                    )
                )
                logger.info("Successfully updated alembic_version to '004_activities'.")
            else:
                logger.info("Database version is already synchronized.")
    except Exception as exc:
        logger.warning(f"Prestart check encountered a non-fatal warning: {exc}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(check_and_sync_alembic_version())
