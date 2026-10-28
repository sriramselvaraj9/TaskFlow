"""Authentication schemas for login, registration, token refresh, sessions, and invitations."""

from typing import Optional
from pydantic import EmailStr, Field

from app.schemas.common import CamelModel
from app.schemas.user import UserResponse


class LoginRequest(CamelModel):
    """Credentials payload for user authentication."""

    email: EmailStr
    password: str = Field(..., min_length=1)


class RegisterRequest(CamelModel):
    """Payload for public user self-registration."""

    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    designation: Optional[str] = Field(default=None, max_length=100)
    role: Optional[str] = Field(default="MEMBER")


class RefreshTokenRequest(CamelModel):
    """Payload carrying the ephemeral refresh token for session rotation."""

    refresh_token: str = Field(..., min_length=1)


class LogoutRequest(CamelModel):
    """Payload for explicitly revoking an active refresh session."""

    refresh_token: Optional[str] = None


class TokenResponse(CamelModel):
    """Standardized JWT authentication response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(TokenResponse):
    """Comprehensive authentication response including user profile."""

    message: str = "Authentication successful"
    user: UserResponse


class SetPasswordRequest(CamelModel):
    """Payload for activating an account password using an invite token."""

    email: EmailStr
    token: str = Field(..., min_length=1)
    password: str = Field(..., min_length=6, max_length=128)
    name: Optional[str] = Field(default=None, max_length=100)




class ForgotPasswordRequest(CamelModel):
    """Payload requesting a password reset link for a corporate account."""

    email: EmailStr
    frontend_url: Optional[str] = None


class ForgotPasswordResponse(CamelModel):
    """Normalized response payload confirming password reset request."""

    success: bool = True
    message: str
    email_sent: bool = True

