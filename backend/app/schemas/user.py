"""User request, response, and authorization schemas."""

from datetime import datetime
from typing import Literal, Optional, Union
from pydantic import EmailStr, Field

from app.schemas.common import CamelModel


class UserBase(CamelModel):
    """Base user data model."""

    name: Optional[str] = Field(default=None, max_length=100)
    email: EmailStr
    role: Literal["ADMIN", "MEMBER"] = Field(default="MEMBER")
    designation: Optional[str] = Field(default=None, max_length=100)


class UserCreate(UserBase):
    """Payload for provisioning a new user account."""

    password: Optional[str] = Field(default=None, min_length=6)
    frontend_url: Optional[str] = None


class UserResponse(UserBase):
    """Public user response entity without sensitive credentials."""

    id: str
    name: str
    created_at: Union[datetime, str]


class ProvisionUserResponse(CamelModel):
    """Response returned upon provisioning a new team member."""

    message: str
    user: UserResponse
    invite_url: str
    email_sent: bool
    email_error: Optional[str] = None


class UserTokenPayload(CamelModel):
    """Contextual user payload carried by security dependencies."""

    id: str
    name: str
    email: str
    role: Literal["ADMIN", "MEMBER"] = "MEMBER"
    designation: Optional[str] = None
