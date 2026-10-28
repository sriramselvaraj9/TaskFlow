"""Asynchronous Redis Cache Service for TaskFlow backend.

Features:
- Cache-Aside pattern (lookup -> DB on miss -> cache -> return).
- Safe JSON serialization & deserialization with support for Pydantic models, dicts, lists, dates, and datetimes.
- Graceful degradation: Ordinary Redis cache failures fall back to PostgreSQL without interrupting user operations.
- Security boundary: Ordinary cache keys are scoped under 'taskflow:cache:' prefix, ensuring security-sensitive
  sessions and rate-limit keys are NEVER affected by cache invalidation.
- Batch pattern invalidation using SCAN. NEVER uses FLUSHDB.
- Scoped cache key builders preventing cross-user data leakage.
"""

from datetime import date, datetime
import hashlib
import json
import logging
from typing import Any, List, Optional
from redis.asyncio import Redis

from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger("taskflow.cache")


class SafeJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder handling datetimes, dates, sets, and Pydantic models."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if hasattr(obj, "model_dump"):
            return obj.model_dump(mode="json", by_alias=True)
        if isinstance(obj, set):
            return list(obj)
        return super().default(obj)


class CacheService:
    """Asynchronous caching service coordinating Redis cache-aside operations."""

    def __init__(self, redis_client: Optional[Redis] = None) -> None:
        self._redis = redis_client
        self.prefix = settings.CACHE_KEY_PREFIX

    async def get_client(self) -> Optional[Redis]:
        """Resolves active Redis client instance."""
        if self._redis is not None:
            return self._redis
        try:
            return await get_redis()
        except Exception as exc:
            logger.warning("Failed to obtain Redis client for cache: %s", exc)
            return None

    def _build_key(self, key: str) -> str:
        """Constructs a fully-qualified, namespaced cache key."""
        clean = key.strip(":")
        return f"{self.prefix}:{clean}"

    # -------------------------------------------------------------------------
    # Key Generators with Authorization Scoping (Prevents Cross-User Leakage)
    # -------------------------------------------------------------------------

    def dashboard_key(
        self,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        role: Optional[str] = None,
    ) -> str:
        """Builds cache key for dashboard metrics."""
        clean_user = user_id or "all"
        clean_proj = project_id or "all"
        clean_role = role or "none"
        return f"dashboard:r:{clean_role}:u:{clean_user}:p:{clean_proj}"

    def tasks_list_key(
        self,
        user_id: Optional[str] = None,
        role: Optional[str] = None,
        project_id: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_id: Optional[str] = None,
        search: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> str:
        """Builds cache key for filtered and paginated task queries."""
        clean_user = user_id or "all"
        clean_role = role or "none"
        clean_proj = project_id or "all"
        clean_status = (status or "ALL").upper()
        clean_priority = (priority or "ALL").upper()
        clean_assignee = assignee_id or "ALL"
        search_hash = "none"
        if search and search.strip():
            search_hash = hashlib.md5(search.strip().lower().encode("utf-8")).hexdigest()[:8]

        page_segment = f":lim:{limit}:off:{offset}" if (limit is not None or offset is not None) else ""

        return (
            f"tasks:r:{clean_role}:u:{clean_user}:p:{clean_proj}:"
            f"st:{clean_status}:pr:{clean_priority}:as:{clean_assignee}:q:{search_hash}{page_segment}"
        )

    def task_detail_key(self, task_id: str) -> str:
        """Builds cache key for a single task."""
        return f"task:{task_id.strip()}"

    def projects_list_key(
        self,
        user_id: Optional[str] = None,
        role: Optional[str] = None,
    ) -> str:
        """Builds cache key for user-accessible project lists."""
        clean_user = user_id or "all"
        clean_role = role or "none"
        return f"projects:r:{clean_role}:u:{clean_user}"

    def project_detail_key(
        self,
        project_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        """Builds cache key for a single project."""
        clean_user = user_id or "all"
        return f"project:{project_id.strip()}:u:{clean_user}"

    def columns_list_key(self) -> str:
        """Builds cache key for board columns."""
        return "columns:all"

    def activities_key(self, limit: int = 20) -> str:
        """Builds cache key for audit activity logs."""
        return f"activities:limit:{limit}"

    def users_list_key(self) -> str:
        """Builds cache key for registered workspace users list."""
        return "users:all"

    def user_detail_key(self, user_id: str) -> str:
        """Builds cache key for a single user profile."""
        return f"user:{user_id.strip()}"

    # -------------------------------------------------------------------------
    # Core Cache Operations with Fail-Open Fallback
    # -------------------------------------------------------------------------

    async def get(self, key: str) -> Optional[Any]:
        """Retrieves and deserializes cached value.
        
        Returns None on cache miss, corruption, or Redis connection errors (fallback to DB).
        """
        if not settings.CACHE_ENABLED:
            return None

        client = await self.get_client()
        if not client:
            return None

        full_key = self._build_key(key)
        try:
            raw = await client.get(full_key)
            if raw is None:
                return None

            try:
                return json.loads(raw)
            except json.JSONDecodeError as exc:
                logger.warning("Corrupted cache payload at key %s: %s (evicting)", full_key, exc)
                await client.delete(full_key)
                return None

        except Exception as exc:
            # Fall back to PostgreSQL where safe
            logger.warning("Redis cache GET failed for key '%s': %s (falling back to database)", full_key, exc)
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """Serializes and caches value with expiration TTL in seconds.
        
        Returns False on serialization error or Redis outage without throwing.
        """
        if not settings.CACHE_ENABLED:
            return False

        client = await self.get_client()
        if not client:
            return False

        full_key = self._build_key(key)
        try:
            payload = json.dumps(value, cls=SafeJSONEncoder)
            await client.set(full_key, payload, ex=ttl)
            return True
        except Exception as exc:
            logger.warning("Redis cache SET failed for key '%s': %s", full_key, exc)
            return False

    async def delete(self, key: str) -> bool:
        """Invalidates a single cache key."""
        if not settings.CACHE_ENABLED:
            return False

        client = await self.get_client()
        if not client:
            return False

        full_key = self._build_key(key)
        try:
            await client.delete(full_key)
            return True
        except Exception as exc:
            logger.warning("Redis cache DELETE failed for key '%s': %s", full_key, exc)
            return False

    async def delete_keys(self, *keys: str) -> int:
        """Deletes multiple explicit cache keys."""
        if not settings.CACHE_ENABLED or not keys:
            return 0

        client = await self.get_client()
        if not client:
            return 0

        full_keys = [self._build_key(k) for k in keys]
        try:
            return await client.delete(*full_keys)
        except Exception as exc:
            logger.warning("Redis cache DELETE_KEYS failed: %s", exc)
            return 0

    async def delete_pattern(self, pattern: str) -> int:
        """Deletes all cache keys matching the glob pattern safely.
        
        CRITICAL: Uses SCAN / scan_iter in batches. Never uses FLUSHDB.
        Only affects keys under 'taskflow:cache:' prefix.
        """
        if not settings.CACHE_ENABLED:
            return 0

        client = await self.get_client()
        if not client:
            return 0

        full_pattern = self._build_key(pattern)
        try:
            keys_to_delete: List[str] = []
            if hasattr(client, "scan_iter"):
                async for k in client.scan_iter(match=full_pattern, count=100):
                    keys_to_delete.append(k)
            elif hasattr(client, "keys"):
                keys_to_delete = await client.keys(full_pattern)

            if not keys_to_delete:
                return 0

            deleted_total = 0
            # Delete in chunks of 100 to avoid blocking the Redis server
            for i in range(0, len(keys_to_delete), 100):
                chunk = keys_to_delete[i : i + 100]
                deleted = await client.delete(*chunk)
                deleted_total += deleted

            logger.debug("Invalidated %d cache keys for pattern '%s'", deleted_total, full_pattern)
            return deleted_total

        except Exception as exc:
            logger.warning("Redis cache DELETE_PATTERN failed for pattern '%s': %s", full_pattern, exc)
            return 0


# Global singleton cache service instance
cache_service = CacheService()
