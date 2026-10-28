"""User management, provisioning, authentication, and account lifecycle business service."""

from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional, Tuple
import urllib.parse
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheService, cache_service as default_cache_service
from app.core.config import settings
from app.core.exceptions import (
    AuthenticationException,
    ConflictException,
    NotFoundException,
    ValidationException,
    WorkflowRestrictionException,
)
from app.core.security import hash_password, verify_password
from app.daos.project_dao import ProjectDAO, project_dao as default_project_dao
from app.core.redis_session import RedisSessionService, redis_session_service as default_redis_session_service
from app.daos.task_dao import TaskDAO, task_dao as default_task_dao
from app.daos.token_dao import TokenDAO, token_dao as default_token_dao
from app.daos.user_dao import UserDAO, user_dao as default_user_dao
from app.models.activity import ActivityAction
from app.models.token import TokenType
from app.models.user import User, UserRole
from app.schemas.auth import ForgotPasswordResponse, RegisterRequest
from app.schemas.user import ProvisionUserResponse, UserCreate, UserResponse, UserTokenPayload
from app.services.activity_service import ActivityService, activity_service as default_activity_service
import logging

from app.services.email_service import send_invite_email, send_password_reset_email

logger = logging.getLogger("taskflow.user")


class UserService:

    """Business operations for user accounts, provisioning, authentication, and offboarding."""

    def __init__(
        self,
        user_dao: Optional[UserDAO] = None,
        project_dao: Optional[ProjectDAO] = None,
        task_dao: Optional[TaskDAO] = None,
        token_dao: Optional[TokenDAO] = None,
        activity_service: Optional[ActivityService] = None,
        cache_service: Optional[CacheService] = None,
        session_service: Optional[RedisSessionService] = None,
    ) -> None:
        self.user_dao = user_dao or default_user_dao
        self.project_dao = project_dao or default_project_dao
        self.task_dao = task_dao or default_task_dao
        self.token_dao = token_dao or default_token_dao
        self.activity_service = activity_service or default_activity_service
        self.cache_service = cache_service or default_cache_service
        self.session_service = session_service or default_redis_session_service

    async def get_users(self, session: AsyncSession) -> List[Any]:
        """Fetch all registered workspace users with cache-aside."""
        cache_key = self.cache_service.users_list_key()
        cached = await self.cache_service.get(cache_key)
        if cached is not None:
            return cached

        users = await self.user_dao.get_all(session)
        serialized = [
            UserResponse.model_validate(u).model_dump(mode="json", by_alias=True)
            for u in users
        ]
        await self.cache_service.set(cache_key, serialized, ttl=settings.CACHE_TTL_USERS)
        return users

    async def get_user(self, session: AsyncSession, user_id: str) -> Any:
        """Fetch single user by ID with cache-aside."""
        cache_key = self.cache_service.user_detail_key(user_id)
        cached = await self.cache_service.get(cache_key)
        if cached is not None:
            return cached

        user = await self.user_dao.get_by_id(session, user_id)
        if not user:
            raise NotFoundException(f"User '{user_id}' not found")

        serialized = UserResponse.model_validate(user).model_dump(mode="json", by_alias=True)
        await self.cache_service.set(cache_key, serialized, ttl=settings.CACHE_TTL_USERS)
        return user

    async def authenticate_user(
        self,
        session: AsyncSession,
        email: str,
        password: str,
    ) -> User:
        """Authenticates user credentials using secure Argon2id/Bcrypt verification.
        
        Avoids leaking whether email exists through timing and error message parity.
        """
        clean_email = email.strip().lower()
        user = await self.user_dao.get_by_email(session, clean_email)

        # Constant-time mitigation against user enumeration
        dummy_hash = "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQxMjM0NTY3OA$9vYfFz8Bwz8..."
        target_hash = user.password_hash if (user and user.password_hash) else dummy_hash

        is_valid = verify_password(password, target_hash)
        if not user or not is_valid:
            raise AuthenticationException("Invalid email or password")

        return user

    async def register_user(
        self,
        session: AsyncSession,
        data: RegisterRequest,
    ) -> User:
        """Public account registration.
        
        Strictly enforces MEMBER role to prevent privilege escalation by public clients.
        """
        clean_email = data.email.strip().lower()
        existing = await self.user_dao.get_by_email(session, clean_email)
        if existing:
            raise ConflictException("A user with this email address already exists")

        if len(data.password) < 6:
            raise ValidationException("Password must be at least 6 characters long")

        # Public self-registration ALWAYS defaults to MEMBER, ignoring client-supplied Admin role
        new_user = User(
            id=str(uuid.uuid4()),
            name=data.name.strip(),
            email=clean_email,
            password_hash=hash_password(data.password),
            role=UserRole.MEMBER,
            designation=data.designation.strip() if data.designation else None,
        )
        created_user = await self.user_dao.create(session, new_user)

        # Automatically enroll in workspace projects
        await self.project_dao.add_user_to_all_projects(session, created_user)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("users:*")
        await self.cache_service.delete_pattern("projects:*")
        await self.cache_service.delete_pattern("activities:*")

        # Log activity
        await self.activity_service.log_activity(
            session=session,
            action=ActivityAction.MEMBER_ASSIGNED,
            details=f"Registered a new MEMBER account '{created_user.name}' ({created_user.email})",
            user_id=created_user.id,
            user_name=created_user.name,
            user_role=created_user.role.value,
        )

        return created_user


    async def set_password_with_token(
        self,
        session: AsyncSession,
        email: str,
        token: str,
        password: str,
        name: Optional[str] = None,
    ) -> User:
        """Consumes invitation token and establishes user account password and full name."""
        clean_email = email.strip().lower()
        clean_token = token.strip()

        if len(password) < 6:
            raise ValidationException("Password must be at least 6 characters long")

        token_record = await self.token_dao.get_valid_token(
            session=session,
            email=clean_email,
            token_type=TokenType.INVITE,
            token_hash=clean_token,
        )
        if not token_record:
            raise ValidationException("Invalid or expired invitation link. Please request a new invite.")

        user = await self.user_dao.get_by_email(session, clean_email)
        if not user:
            raise NotFoundException("User account associated with invitation was not found")

        # Hash new password with Argon2id
        user.password_hash = hash_password(password)

        # Update member's full name if provided during activation
        if name and name.strip():
            clean_name = name.strip()
            if len(clean_name) >= 2:
                user.name = clean_name

        await self.user_dao.update(session, user)

        # Invalidate/consume token
        await self.token_dao.consume_token(session, token_record.id)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("users:*")
        await self.cache_service.delete_pattern("user:*")
        await self.cache_service.delete_pattern("activities:*")

        # Revoke all active login sessions in Redis so any compromised session is terminated
        try:
            await self.session_service.revoke_all_user_sessions(user.id)
        except Exception as exc:
            logger.warning("Failed to revoke Redis sessions on password reset for %s: %s", user.id, exc)

        # Log activity
        await self.activity_service.log_activity(
            session=session,
            action=ActivityAction.MEMBER_ASSIGNED,
            details=f"Completed account activation and password setup for '{user.email}'",
            user_id=user.id,
            user_name=user.name,
            user_role=user.role.value,
        )

        return user


    async def request_password_reset(
        self,
        session: AsyncSession,
        email: str,
        frontend_url: Optional[str] = None,
    ) -> ForgotPasswordResponse:
        """Processes forgot-password request, generates a 15-minute token, and sends reset email.
        
        Preserves strict security parity: always returns success to mitigate user enumeration.
        """
        clean_email = email.strip().lower()
        user = await self.user_dao.get_by_email(session, clean_email)

        generic_message = (
            "If an account with this email address exists, a password reset link has been sent to your inbox."
        )

        if not user:
            # Mitigation against account enumeration: return identical success message
            logger.info("Forgot-password request for non-existent email '%s'", clean_email)
            return ForgotPasswordResponse(message=generic_message, email_sent=True)

        # Invalidate existing unused invite/reset tokens for this email
        await self.token_dao.invalidate_tokens_for_email(session, user.email, TokenType.INVITE)

        # Generate single-use, 15-minute reset token
        token_hash = uuid.uuid4().hex
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        await self.token_dao.create_token(
            session=session,
            email=user.email,
            token_type=TokenType.INVITE,
            token_hash=token_hash,
            expires_at=expires_at,
        )

        base_url = frontend_url.rstrip("/") if frontend_url else "http://localhost:3000"
        encoded_email = urllib.parse.quote(user.email)
        reset_url = f"{base_url}/auth/set-password?token={token_hash}&email={encoded_email}&reset=true"

        # Invalidate activities cache
        await self.cache_service.delete_pattern("activities:*")

        # Log security audit activity
        await self.activity_service.log_activity(
            session=session,
            action=ActivityAction.MEMBER_ASSIGNED,
            details=f"Password reset link requested for '{user.email}'",
            user_id=user.id,
            user_name=user.name,
            user_role=user.role.value,
        )

        # Send password reset email via Brevo / SMTP with Jinja2 template
        await send_password_reset_email(
            to_email=user.email,
            to_name=user.name,
            reset_url=reset_url,
        )

        return ForgotPasswordResponse(message=generic_message, email_sent=True)

    async def provision_user(
        self,
        session: AsyncSession,
        data: UserCreate,
        current_user: UserTokenPayload,
    ) -> ProvisionUserResponse:
        clean_name = data.name.strip() if data.name and data.name.strip() else (data.email.split("@")[0] if "@" in data.email else "Team Member")

        # Name is not unique (multiple members can share identical names); only email is unique
        existing = await self.user_dao.get_by_email(session, data.email)
        if existing:
            raise ConflictException(f"User with email '{data.email}' already exists")

        initial_hash = hash_password(data.password) if data.password else "temp_provision_token_hash"
        new_user = User(
            id=str(uuid.uuid4()),
            name=clean_name,
            email=data.email.strip().lower(),
            password_hash=initial_hash,
            role=UserRole(data.role),
            designation=data.designation.strip() if data.designation else None,
        )
        created_user = await self.user_dao.create(session, new_user)

        # Automatically enroll in all projects
        await self.project_dao.add_user_to_all_projects(session, created_user)

        # Generate ephemeral invite token (7-day validity)
        invite_token = uuid.uuid4().hex
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await self.token_dao.create_token(
            session=session,
            email=created_user.email,
            token_type=TokenType.INVITE,
            token_hash=invite_token,
            expires_at=expires_at,
        )

        base_url = data.frontend_url.rstrip("/") if data.frontend_url else "http://localhost:3000"
        encoded_email = urllib.parse.quote(created_user.email)
        invite_url = f"{base_url}/auth/set-password?token={invite_token}&email={encoded_email}"

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("users:*")
        await self.cache_service.delete_pattern("projects:*")
        await self.cache_service.delete_pattern("activities:*")

        # Audit log
        await self.activity_service.log_activity(
            session=session,
            action=ActivityAction.MEMBER_ASSIGNED,
            details=f"Provisioned member '{created_user.name}' ({created_user.email})",
            user_id=current_user.id,
            user_name=current_user.name,
            user_role=current_user.role,
        )

        # Dispatch invitation email asynchronously via backend email service
        email_sent = await send_invite_email(
            to_email=created_user.email,
            to_name=created_user.name,
            invite_url=invite_url,
            inviter_name=current_user.name or "Admin",
            designation=created_user.designation,
        )

        return ProvisionUserResponse(
            message="User provisioned successfully",
            user=UserResponse.model_validate(created_user),
            invite_url=invite_url,
            email_sent=email_sent,
            email_error=None if email_sent else "Email could not be delivered automatically. Use direct link below.",
        )

    async def delete_user(
        self,
        session: AsyncSession,
        user_id: str,
        current_user: UserTokenPayload,
    ) -> User:
        """Offboard member: unassign tasks to Backlog, remove project memberships, delete user."""
        if current_user and current_user.id == user_id:
            raise WorkflowRestrictionException("Users cannot delete their own account")

        user = await self.user_dao.get_by_id(session, user_id)
        if not user:
            raise NotFoundException(f"User '{user_id}' not found")

        # 1. Unassign all tasks assigned to user and move them to BACKLOG
        await self.task_dao.unassign_user_tasks(session, user_id=user_id, new_status="BACKLOG")

        # 2. Remove user from all project memberships
        await self.project_dao.remove_user_from_all_projects(session, user_id=user_id)

        # 3. Invalidate tokens
        await self.token_dao.invalidate_tokens_for_email(session, user.email, TokenType.INVITE)

        # 4. Delete user record
        deleted = await self.user_dao.delete(session, user)

        # Invalidate affected cache keys
        await self.cache_service.delete_pattern("users:*")
        await self.cache_service.delete_pattern("user:*")
        await self.cache_service.delete_pattern("projects:*")
        await self.cache_service.delete_pattern("tasks:*")
        await self.cache_service.delete_pattern("dashboard:*")
        await self.cache_service.delete_pattern("activities:*")

        # Audit log
        await self.activity_service.log_activity(
            session=session,
            action=ActivityAction.MEMBER_ASSIGNED,
            details=f"Removed member '{deleted.name}' ({deleted.email})",
            user_id=current_user.id,
            user_name=current_user.name,
            user_role=current_user.role,
        )

        return deleted


user_service = UserService()
