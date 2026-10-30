"""Authentication, credential verification, and session coordination service."""

from typing import Any, Callable, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AuthenticationException
from app.core.rate_limiter import check_login_rate_limit, reset_login_rate_limit
from app.core.redis_session import RedisSessionService, redis_session_service as default_redis_session_service
from app.core.security import create_access_token, decode_token
from app.daos.user_dao import UserDAO, user_dao as default_user_dao
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    SetPasswordRequest,
    TokenResponse,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserResponse, UserTokenPayload
from app.services.user_service import UserService, user_service as default_user_service


class AuthService:
    """Business operations for authentication, JWT lifecycle, and sessions."""

    def __init__(
        self,
        user_service: Optional[UserService] = None,
        user_dao: Optional[UserDAO] = None,
        session_service: Optional[RedisSessionService] = None,
        rate_limiter_check: Optional[Callable] = None,
        rate_limiter_reset: Optional[Callable] = None,
    ) -> None:
        self.user_service = user_service or default_user_service
        self.user_dao = user_dao or default_user_dao
        self.session_service = session_service or default_redis_session_service
        self.rate_limiter_check = rate_limiter_check or check_login_rate_limit
        self.rate_limiter_reset = rate_limiter_reset or reset_login_rate_limit

    async def register(
        self,
        session: AsyncSession,
        data: RegisterRequest,
        client_ip: str,
        user_agent: Optional[str] = None,
    ) -> AuthResponse:
        """Coordinate public registration, Redis session establishment, and access token issuance."""
        user = await self.user_service.register_user(session, data)

        refresh_token, session_id, _ = await self.session_service.create_session(
            user_id=user.id,
            client_ip=client_ip,
            user_agent=user_agent,
        )

        access_token = create_access_token({
            "sub": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "designation": user.designation,
        })

        return AuthResponse(
            message="Account registered successfully",
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
        )

    async def login(
        self,
        session: AsyncSession,
        data: LoginRequest,
        client_ip: str,
        user_agent: Optional[str] = None,
    ) -> AuthResponse:
        """Authenticate user credentials against rate limits, establish Redis session, and return tokens."""
        # 1. Enforce rate limiting before credential verification to mitigate enumeration
        await self.rate_limiter_check(ip=client_ip, email=data.email)

        # 2. Authenticate user credentials securely
        user = await self.user_service.authenticate_user(session, data.email, data.password)

        # 3. Clear rate limit record on successful authentication
        await self.rate_limiter_reset(ip=client_ip, email=data.email)

        # 4. Issue refresh session in Redis
        refresh_token, session_id, _ = await self.session_service.create_session(
            user_id=user.id,
            client_ip=client_ip,
            user_agent=user_agent,
        )

        # 5. Issue cryptographic access token
        access_token = create_access_token({
            "sub": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "designation": user.designation,
        })

        return AuthResponse(
            message="Signed in successfully",
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
        )

    async def refresh_tokens(
        self,
        session: AsyncSession,
        refresh_token: str,
    ) -> TokenResponse:
        """Rotate refresh token and issue a fresh access token."""
        new_refresh_token, user_id, session_id = await self.session_service.rotate_refresh_token(
            refresh_token
        )

        user = await self.user_dao.get_by_id(session, user_id)
        if not user:
            raise AuthenticationException("Unauthorized: Associated user account no longer exists")

        access_token = create_access_token({
            "sub": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "designation": user.designation,
        })

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def logout(
        self,
        refresh_token: Optional[str] = None,
        current_user: Optional[UserTokenPayload] = None,
    ) -> MessageResponse:
        """Terminate active session and revoke refresh tokens."""
        if refresh_token:
            try:
                payload = decode_token(refresh_token, expected_type="refresh")
                session_id = payload.get("sid")
                if session_id:
                    await self.session_service.revoke_session(session_id)
            except Exception:
                pass

        return MessageResponse(message="Logged out successfully")

    async def get_current_user_profile(
        self,
        session: AsyncSession,
        current_user: UserTokenPayload,
    ) -> UserResponse:
        """Retrieve authoritative profile of authenticated user."""
        user = await self.user_dao.get_by_id(session, current_user.id)
        if not user:
            raise AuthenticationException("User account not found")
        return UserResponse.model_validate(user)


    async def set_password(
        self,
        session: AsyncSession,
        data: SetPasswordRequest,
    ) -> Dict[str, Any]:
        """Activate user account password with invitation token."""
        user = await self.user_service.set_password_with_token(
            session=session,
            email=data.email,
            token=data.token,
            password=data.password,
            name=data.name,
        )
        return {
            "message": "Password created successfully. You can now access your workspace.",
            "user": UserResponse.model_validate(user),
        }

    async def forgot_password(
        self,
        session: AsyncSession,
        email: str,
        frontend_url: Optional[str] = None,
        client_ip: Optional[str] = None,
    ) -> ForgotPasswordResponse:
        """Processes self-service password reset request."""
        return await self.user_service.request_password_reset(
            session=session,
            email=email,
            frontend_url=frontend_url,
        )


auth_service = AuthService()

