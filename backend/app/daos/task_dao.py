"""Task Data Access Object with database-level aggregation."""

from datetime import date
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.daos.base import BaseDAO
from app.models.task import Task, TaskPriority


class TaskDAO(BaseDAO[Task]):
    """Data Access Object for Task entity with filtering and metrics aggregation."""

    def __init__(self):
        super().__init__(Task)

    async def get_filtered(
        self,
        session: AsyncSession,
        project_id: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_id: Optional[str] = None,
        search: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Task]:
        """Fetch tasks matching multiple filter criteria sorted by updatedAt descending with optional pagination."""
        stmt = select(Task)

        if project_id and project_id != "ALL":
            stmt = stmt.where(Task.project_id == project_id)

        if status and status != "ALL":
            stmt = stmt.where(Task.status == status)

        if priority and priority != "ALL":
            stmt = stmt.where(Task.priority == TaskPriority(priority))

        if assignee_id and assignee_id != "ALL":
            stmt = stmt.where(Task.assignee_id == assignee_id)

        if search and search.strip():
            pattern = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    Task.title.ilike(pattern),
                    Task.description.ilike(pattern),
                )
            )

        stmt = stmt.order_by(Task.updated_at.desc())

        if offset is not None:
            stmt = stmt.offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)

        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def migrate_column_tasks(
        self,
        session: AsyncSession,
        column_id: str,
        new_status: str = "BACKLOG",
    ) -> int:
        """Migrates all tasks from a deleted column into a target workflow column."""
        stmt = (
            update(Task)
            .where(Task.status == column_id)
            .values(status=new_status, updated_at=func.now())
        )
        result = await session.execute(stmt)
        await session.flush()
        return result.rowcount

    async def unassign_user_tasks(
        self,
        session: AsyncSession,
        user_id: str,
        new_status: str = "BACKLOG",
    ) -> int:
        """Unassigns tasks from a deleted member and resets their status to BACKLOG."""
        stmt = (
            update(Task)
            .where(Task.assignee_id == user_id)
            .values(assignee_id=None, status=new_status, updated_at=func.now())
        )
        result = await session.execute(stmt)
        await session.flush()
        return result.rowcount

    async def get_dashboard_metrics(
        self,
        session: AsyncSession,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> Tuple[int, int, int, int, int, Dict[str, int], Dict[str, int]]:
        """Calculates dashboard KPI metrics via database aggregation.

        Returns: (total_tasks, completed_tasks, in_progress_tasks, overdue_count, assigned_to_me,
        status_counts, priority_counts)
        """
        # 1. Status aggregation
        status_stmt = select(Task.status, func.count(Task.id))
        if project_id and project_id != "ALL":
            status_stmt = status_stmt.where(Task.project_id == project_id)
        status_stmt = status_stmt.group_by(Task.status)
        status_res = await session.execute(status_stmt)

        status_counts: Dict[str, int] = {
            "BACKLOG": 0,
            "TODO": 0,
            "IN_PROGRESS": 0,
            "IN_REVIEW": 0,
            "DONE": 0,
        }
        for st, count in status_res.all():
            status_counts[st] = count

        # 2. Priority aggregation
        prio_stmt = select(Task.priority, func.count(Task.id))
        if project_id and project_id != "ALL":
            prio_stmt = prio_stmt.where(Task.project_id == project_id)
        prio_stmt = prio_stmt.group_by(Task.priority)
        prio_res = await session.execute(prio_stmt)

        priority_counts: Dict[str, int] = {
            "LOW": 0,
            "MEDIUM": 0,
            "HIGH": 0,
        }
        for pr, count in prio_res.all():
            priority_counts[pr.value if hasattr(pr, "value") else str(pr)] = count

        # 3. Overdue tasks count: due_date < current_date and status != 'DONE'
        today = date.today()
        overdue_stmt = select(func.count(Task.id)).where(
            Task.due_date < today,
            Task.status != "DONE",
        )
        if project_id and project_id != "ALL":
            overdue_stmt = overdue_stmt.where(Task.project_id == project_id)
        overdue_res = await session.execute(overdue_stmt)
        overdue_count = overdue_res.scalar_one()

        # 4. Assigned to current user count: assignee_id == user_id and status != 'DONE'
        assigned_to_me = 0
        if user_id:
            assigned_stmt = select(func.count(Task.id)).where(
                Task.assignee_id == user_id,
                Task.status != "DONE",
            )
            if project_id and project_id != "ALL":
                assigned_stmt = assigned_stmt.where(Task.project_id == project_id)
            assigned_res = await session.execute(assigned_stmt)
            assigned_to_me = assigned_res.scalar_one()

        total_tasks = sum(status_counts.values())
        completed_tasks = status_counts.get("DONE", 0)
        in_progress_tasks = status_counts.get("IN_PROGRESS", 0)

        return (
            total_tasks,
            completed_tasks,
            in_progress_tasks,
            overdue_count,
            assigned_to_me,
            status_counts,
            priority_counts,
        )


task_dao = TaskDAO()
