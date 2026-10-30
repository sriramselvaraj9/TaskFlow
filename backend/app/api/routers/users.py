"""Users API router."""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, get_user_service, require_admin
from app.schemas.common import MessageResponse
from app.schemas.user import ProvisionUserResponse, UserCreate, UserResponse, UserTokenPayload
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> List[UserResponse]:
    """Retrieve all registered users."""
    users = await user_service.get_users(session)
    return [UserResponse.model_validate(u) for u in users]


@router.post("/create", response_model=ProvisionUserResponse, status_code=status.HTTP_201_CREATED)
async def provision_user(
    data: UserCreate,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(require_admin),
    user_service: UserService = Depends(get_user_service),
) -> ProvisionUserResponse:
    """Provision a new team member and generate an invitation link (Admin only)."""
    return await user_service.provision_user(session, data, current_user)


@router.get("/{id}", response_model=UserResponse)
async def get_user(
    id: str,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> UserResponse:
    """Retrieve user profile by ID."""
    user = await user_service.get_user(session, id)
    return UserResponse.model_validate(user)


@router.delete("/{id}", response_model=MessageResponse)
async def delete_user(
    id: str,
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(require_admin),
    user_service: UserService = Depends(get_user_service),
) -> MessageResponse:
    """Delete a user, unassign their tasks to Backlog, and revoke memberships (Admin only)."""
    await user_service.delete_user(session, id, current_user)
    return MessageResponse(message="Team member deleted successfully")
