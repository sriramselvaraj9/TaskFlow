"""Schemas aggregator."""

from app.schemas.activity import ActivityLogResponse
from app.schemas.column import (
    ColumnCreate,
    ColumnDeleteResponse,
    ColumnReorder,
    ColumnResponse,
)
from app.schemas.common import CamelModel, MessageResponse
from app.schemas.dashboard import DashboardStatsResponse
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)
from app.schemas.task import (
    TaskCreate,
    TaskFilterParams,
    TaskResponse,
    TaskUpdate,
)
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    SetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import (
    ProvisionUserResponse,
    UserCreate,
    UserResponse,
    UserTokenPayload,
)

__all__ = [
    "AuthResponse",
    "ForgotPasswordRequest",
    "ForgotPasswordResponse",
    "LoginRequest",
    "LogoutRequest",
    "RefreshTokenRequest",
    "RegisterRequest",
    "SetPasswordRequest",
    "TokenResponse",
    "CamelModel",
    "MessageResponse",
    "UserCreate",
    "UserResponse",
    "ProvisionUserResponse",
    "UserTokenPayload",
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectResponse",
    "ColumnCreate",
    "ColumnReorder",
    "ColumnResponse",
    "ColumnDeleteResponse",
    "TaskCreate",
    "TaskUpdate",
    "TaskResponse",
    "TaskFilterParams",
    "DashboardStatsResponse",
    "ActivityLogResponse",
]
