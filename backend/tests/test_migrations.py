"""Alembic database schema migration upgrade and downgrade integration test.

Validates:
1. Complete migration upgrade from base to head against an isolated SQLite test database.
2. Creation of all domain tables (users, projects, project_members, board_columns, tasks, activity_logs, tokens).
3. Complete migration downgrade from head back to base.
4. Clean table removal upon downgrade.
5. Idempotent re-upgrade to head.
"""

import os
from unittest.mock import patch
from alembic.config import Config
from alembic import command
import sqlalchemy as sa


def test_alembic_migration_upgrade_and_downgrade(tmp_path):
    """Test Alembic migration cycle: base -> head -> base -> head."""
    db_file = tmp_path / "test_migration.db"
    db_url = f"sqlite+aiosqlite:///{db_file.as_posix()}"
    sync_url = f"sqlite:///{db_file.as_posix()}"

    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    alembic_ini_path = os.path.join(backend_dir, "alembic.ini")
    alembic_dir = os.path.join(backend_dir, "alembic")

    alembic_cfg = Config(alembic_ini_path)
    alembic_cfg.set_main_option("script_location", alembic_dir)

    with patch("app.core.config.settings.DATABASE_URL", db_url):
        # 1. Upgrade from base to head
        command.upgrade(alembic_cfg, "head")

        # 2. Inspect created tables
        sync_engine = sa.create_engine(sync_url)
        inspector = sa.inspect(sync_engine)
        tables = set(inspector.get_table_names())
        sync_engine.dispose()

        expected_tables = {
            "users",
            "projects",
            "project_members",
            "board_columns",
            "tasks",
            "activities",
            "user_tokens",
            "alembic_version",
        }
        assert expected_tables.issubset(tables), f"Missing tables after upgrade: {expected_tables - tables}"

        # Verify columns on tasks table
        sync_engine = sa.create_engine(sync_url)
        inspector = sa.inspect(sync_engine)
        task_columns = {col["name"] for col in inspector.get_columns("tasks")}
        sync_engine.dispose()
        assert {"id", "title", "description", "status", "priority", "project_id", "due_date"}.issubset(task_columns)

        # 3. Downgrade from head to base
        command.downgrade(alembic_cfg, "base")

        sync_engine = sa.create_engine(sync_url)
        inspector = sa.inspect(sync_engine)
        remaining_tables = set(inspector.get_table_names()) - {"alembic_version"}
        sync_engine.dispose()
        assert len(remaining_tables) == 0, f"Tables still present after downgrade: {remaining_tables}"

        # 4. Idempotent re-upgrade to head
        command.upgrade(alembic_cfg, "head")
        sync_engine = sa.create_engine(sync_url)
        inspector = sa.inspect(sync_engine)
        reupgraded_tables = set(inspector.get_table_names())
        sync_engine.dispose()
        assert expected_tables.issubset(reupgraded_tables)
