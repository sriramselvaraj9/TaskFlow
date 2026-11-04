"""Activities schema.

Revision ID: 004_activities
Revises: 003_tasks
Create Date: 2026-10-22 11:33:00.000000
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004_activities"
down_revision: Union[str, None] = "003_tasks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Activities Table
    op.create_table(
        "activities",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=30), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("user_name", sa.String(length=100), nullable=False),
        sa.Column("user_role", sa.String(length=20), nullable=False),
        sa.Column("project_id", sa.String(length=64), nullable=True),
        sa.Column("task_id", sa.String(length=64), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_activities_timestamp", "activities", ["timestamp"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_activities_timestamp", table_name="activities")
    op.drop_table("activities")

