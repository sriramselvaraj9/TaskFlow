"""Redis-backed session management: refresh token rotation, reuse detection, and session revocation."""

import asyncio
from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, Optional, Tuple
import uuid

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.exceptions import AuthenticationException
from app.core.redis import get_redis
from app.core.security import create_refresh_token, decode_token, hash_token

logger = logging.getLogger("taskflow.session")

# Ephemeral in-memory session fallback for cloud environments without Redis
_IN_MEMORY_SESSIONS: Dict[str, Dict[str, Any]] = {}
_IN_MEMORY_USER_SESSIONS: Dict[str, set] = {}


class RedisSessionService:
    """Manages ephemeral user refresh sessions, cryptographic rotation, and reuse detection."""

    def __init__(self, redis_client: Optional[Redis] = None) -> None:
        self._redis = redis_client

    async def _get_client(self) -> Redis:
        """Returns the configured or default Redis client."""
        if self._redis is not None:
            return self._redis
        return await get_redis()

    async def create_session(
        self,
        user_id: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[str, str, str]:
        """Creates a new refresh session and issues initial refresh token.
        
        Returns tuple of (refresh_token, session_id, token_jti).
        """
        redis = await self._get_client()
        session_id = uuid.uuid4().hex
        
        refresh_token, jti = create_refresh_token(user_id=user_id, session_id=session_id)
        token_hash = hash_token(jti)
        ttl_seconds = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400

        session_data = {
            "session_id": session_id,
            "user_id": user_id,
            "current_token_hash": token_hash,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_rotated_at": datetime.now(timezone.utc).isoformat(),
            "revoked": False,
            "ip": client_ip,
            "user_agent": user_agent,
        }

        session_key = f"taskflow:session:{session_id}"
        user_set_key = f"taskflow:user_sessions:{user_id}"

        try:
            await redis.set(session_key, json.dumps(session_data), ex=ttl_seconds)
            await redis.sadd(user_set_key, session_id)
            await redis.expire(user_set_key, ttl_seconds)
        except Exception as exc:
            logger.warning("Redis session creation failed (%s), using in-memory session fallback", exc)
            _IN_MEMORY_SESSIONS[session_key] = session_data
            if user_id not in _IN_MEMORY_USER_SESSIONS:
                _IN_MEMORY_USER_SESSIONS[user_id] = set()
            _IN_MEMORY_USER_SESSIONS[user_id].add(session_id)

        return refresh_token, session_id, jti

    async def rotate_refresh_token(
        self,
        refresh_token: str,
    ) -> Tuple[str, str, str]:
        """Atomically rotates a refresh token, enforcing reuse detection and invalidating previous token.
        
        Returns tuple of (new_refresh_token, user_id, session_id).
        Raises AuthenticationException (401) on invalid signature, expired session, or reuse detection.
        """
        # 1. Cryptographically decode and verify JWT signature and claims
        payload = decode_token(refresh_token, expected_type="refresh")
        user_id = payload.get("sub")
        session_id = payload.get("sid")
        presented_jti = payload.get("jti")

        if not user_id or not session_id or not presented_jti:
            raise AuthenticationException("Unauthorized: Malformed refresh token claims")

        presented_hash = hash_token(presented_jti)
        redis = await self._get_client()

        # 2. Concurrency protection using atomic lock
        lock_key = f"taskflow:lock:session:{session_id}"
        session_key = f"taskflow:session:{session_id}"

        lock_acquired = False
        try:
            raw_session = None
            try:
                # Try to acquire concurrency lock with 5 second auto-expiry
                for _ in range(5):
                    lock_acquired = bool(await redis.set(lock_key, "1", nx=True, px=5000))
                    if lock_acquired:
                        break
                    await asyncio.sleep(0.05)

                if lock_acquired:
                    raw_session = await redis.get(session_key)
            except Exception:
                pass

            # Fall back to in-memory store if Redis is unavailable
            if raw_session:
                session_data = json.loads(raw_session)
            elif session_key in _IN_MEMORY_SESSIONS:
                session_data = _IN_MEMORY_SESSIONS[session_key]
            else:
                raise AuthenticationException("Unauthorized: Refresh session expired or invalid")

            if session_data.get("revoked", False):
                raise AuthenticationException("Unauthorized: Refresh session has been revoked")

            # 4. Refresh-Token Reuse Detection
            current_hash = session_data.get("current_token_hash")
            if current_hash != presented_hash:
                logger.warning(
                    "SECURITY: Refresh token reuse detected for session %s (user %s)! Revoking entire session.",
                    session_id,
                    user_id,
                )
                session_data["revoked"] = True
                try:
                    await redis.set(session_key, json.dumps(session_data), ex=300)
                except Exception:
                    _IN_MEMORY_SESSIONS[session_key] = session_data
                raise AuthenticationException("Unauthorized: Refresh token reuse detected. Session revoked.")

            # 5. Token Rotation: Issue fresh refresh token and advance session state
            new_refresh_token, new_jti = create_refresh_token(user_id=user_id, session_id=session_id)
            new_hash = hash_token(new_jti)

            session_data["current_token_hash"] = new_hash
            session_data["last_rotated_at"] = datetime.now(timezone.utc).isoformat()

            try:
                remaining_ttl = await redis.ttl(session_key)
                if remaining_ttl <= 0:
                    remaining_ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
                await redis.set(session_key, json.dumps(session_data), ex=remaining_ttl)
            except Exception:
                _IN_MEMORY_SESSIONS[session_key] = session_data

            return new_refresh_token, user_id, session_id

        except AuthenticationException:
            raise
        except Exception as exc:
            logger.error("Session verification failed: %s", exc)
            raise AuthenticationException("Session verification failed: authentication service unavailable")
        finally:
            if lock_acquired:
                try:
                    await redis.delete(lock_key)
                except Exception:
                    pass

    async def revoke_session(self, session_id: str) -> bool:
        """Revokes a specific refresh session."""
        session_key = f"taskflow:session:{session_id}"
        _IN_MEMORY_SESSIONS.pop(session_key, None)
        try:
            redis = await self._get_client()
            raw = await redis.get(session_key)
            if raw:
                session_data = json.loads(raw)
                session_data["revoked"] = True
                await redis.set(session_key, json.dumps(session_data), ex=60)
            await redis.delete(session_key)
            return True
        except Exception as exc:
            logger.warning("Redis session revocation error: %s", exc)
            return True

    async def revoke_user_sessions(self, user_id: str) -> int:
        """Revokes all active sessions for a user (e.g., on password reset or offboarding)."""
        sids = _IN_MEMORY_USER_SESSIONS.pop(user_id, set())
        for sid in sids:
            _IN_MEMORY_SESSIONS.pop(f"taskflow:session:{sid}", None)
        count = len(sids)
        try:
            redis = await self._get_client()
            user_set_key = f"taskflow:user_sessions:{user_id}"
            session_ids = await redis.smembers(user_set_key)
            for sid in session_ids:
                session_key = f"taskflow:session:{sid}"
                await redis.delete(session_key)
                count += 1
            await redis.delete(user_set_key)
            return count
        except Exception as exc:
            logger.warning("Redis user sessions revocation error: %s", exc)
            return count


# Default session service instance
redis_session_service = RedisSessionService()
