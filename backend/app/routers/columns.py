"""Board Column API router."""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_column_service, get_current_user, get_db, require_admin
from app.schemas.column import ColumnCreate, ColumnDeleteResponse, ColumnReorder, ColumnResponse
from app.schemas.user import UserTokenPayload
from app.services.column_service import ColumnService

router = APIRouter(prefix="/columns", tags=["Columns"])


@router.get("", response_model=List[ColumnResponse])
async def list_columns(
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    column_service: ColumnService = Depends(get_column_service),
) -> List[ColumnResponse]:
    """Retrieve all workflow columns sorted by order."""
    columns = await column_service.get_columns(session)
    return [ColumnResponse.model_validate(c) for c in columns]


@router.post("", response_model=ColumnResponse, status_code=status.HTTP_201_CREATED)
async def create_column(
    data: ColumnCreate,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(require_admin),
    column_service: ColumnService = Depends(get_column_service),
) -> ColumnResponse:
    """Create a new custom workflow column (Admin only)."""
    col = await column_service.create_column(session, data, current_user)
    return ColumnResponse.model_validate(col)


@router.post("/reorder", response_model=List[ColumnResponse])
@router.put("/reorder", response_model=List[ColumnResponse])
async def reorder_columns(
    data: ColumnReorder,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(require_admin),
    column_service: ColumnService = Depends(get_column_service),
) -> List[ColumnResponse]:
    """Atomically update workflow column sequence (Admin only)."""
    columns = await column_service.reorder_columns(session, data.column_ids, current_user)
    return [ColumnResponse.model_validate(c) for c in columns]


@router.delete("/{id}", response_model=ColumnDeleteResponse)
async def delete_column(
    id: str,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(require_admin),
    column_service: ColumnService = Depends(get_column_service),
) -> ColumnDeleteResponse:
    """Delete a custom column and migrate its tasks to Backlog (Admin only)."""
    deleted_col, moved_count = await column_service.delete_column(session, id, current_user)
    return ColumnDeleteResponse(
        message="Column deleted successfully",
        moved_tasks_count=moved_count,
        deleted_column=ColumnResponse.model_validate(deleted_col),
    )
