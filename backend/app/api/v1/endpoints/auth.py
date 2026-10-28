"""Authentication API router: login, registration, token refresh, sessions, and invitations."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_auth_service, get_current_user
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    SetPasswordRequest,
    TokenResponse,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserResponse, UserTokenPayload
from app.services.auth_service import AuthService

router = APIRouter(tags=["Authentication"])


def _extract_client_ip(request: Request) -> str:
    """Extracts client IP address respecting X-Forwarded-For headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"



@router.post("/auth/login", response_model=AuthResponse)
async def login(
    data: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    """Authenticate corporate credentials and establish an active JWT session.
    
    Protected against brute-force attacks via atomic Redis rate limiting.
    """
    client_ip = _extract_client_ip(request)
    user_agent = request.headers.get("user-agent")
    return await auth_service.login(
        session=session,
        data=data,
        client_ip=client_ip,
        user_agent=user_agent,
    )


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_tokens(
    data: RefreshTokenRequest,
    session: AsyncSession = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    """Rotates refresh token and issues a new access token.
    
    Performs reuse detection, previous-token invalidation, and session tracking.
    """
    return await auth_service.refresh_tokens(
        session=session,
        refresh_token=data.refresh_token,
    )


@router.post("/auth/logout", response_model=MessageResponse)
async def logout(
    data: Optional[LogoutRequest] = None,
    current_user: Optional[UserTokenPayload] = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    """Terminates active session and revokes tokens."""
    return await auth_service.logout(
        refresh_token=data.refresh_token if data else None,
        current_user=current_user,
    )


@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_profile(
    session: AsyncSession = Depends(get_db),
    current_user: UserTokenPayload = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """Retrieves authoritative authenticated user profile."""
    return await auth_service.get_current_user_profile(
        session=session,
        current_user=current_user,
    )


@router.post("/auth/set-password", response_model=Dict[str, Any])
async def set_password(
    data: SetPasswordRequest,
    session: AsyncSession = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service),
) -> Dict[str, Any]:
    """Sets account password with a valid invitation token."""
    return await auth_service.set_password(
        session=session,
        data=data,
    )


@router.post("/auth/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service),
) -> ForgotPasswordResponse:
    """Request a single-use 15-minute password reset link sent to corporate email."""
    client_ip = _extract_client_ip(request)
    return await auth_service.forgot_password(
        session=session,
        email=data.email,
        frontend_url=data.frontend_url,
        client_ip=client_ip,
    )

