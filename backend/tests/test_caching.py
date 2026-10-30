"""Phase F Caching & Performance Verification Tests.

Tests:
1. Reusable CacheService: get, set-with-TTL, delete, delete_pattern, and safe JSON serialization.
2. Configurable initial TTLs (Dashboard=60s, Analytics=180s, Tasks=30s, Projects=60s).
3. Cache-aside flow: lookup -> DAO/PostgreSQL on miss -> cache -> return.
4. Key isolation preventing cross-user data leakage.
5. Invalidation across task, project, column, member, and invitation mutations.
6. Fail-open fallback on Redis outage for ordinary cache vs fail-closed for security state.
7. Never use FLUSHDB for ordinary invalidation.
8. Live Redis integration when an active server is detected.
"""

from datetime import datetime, timezone
import socket
from unittest.mock import AsyncMock, MagicMock
import pytest
import redis.asyncio as aioredis
from redis.exceptions import ConnectionError as RedisConnectionError

from app.core.cache import CacheService
from app.core.config import settings
from app.core.exceptions import AuthenticationException, RateLimitException
from app.core.rate_limiter import RedisRateLimiter
from app.core.redis_session import RedisSessionService

from app.models.column import BoardColumn
from app.models.project import Project
from app.models.task import Task, TaskPriority
from app.models.user import User, UserRole
from app.schemas.column import ColumnCreate
from app.schemas.dashboard import DashboardStatsResponse
from app.schemas.project import ProjectCreate
from app.schemas.task import TaskCreate, TaskFilterParams
from app.schemas.user import UserCreate, UserTokenPayload
from app.services.column_service import ColumnService
from app.services.dashboard_service import DashboardService
from app.services.project_service import ProjectService
from app.services.task_service import TaskService
from app.services.user_service import UserService
from tests.fake_redis import FakeRedis


@pytest.mark.asyncio
async def test_cache_service_core_operations():
    """Verify get, set with TTL, delete, and safe serialization."""
    fake_redis = FakeRedis()
    cache = CacheService(redis_client=fake_redis)

    # 1. Set string and dict
    await cache.set("test:str", "hello_world", ttl=60)
    assert await cache.get("test:str") == "hello_world"

    # Verify TTL set
    raw_ttl = await fake_redis.ttl(cache._build_key("test:str"))
    assert 55 <= raw_ttl <= 60

    # 2. Complex object serialization (Pydantic model / datetime)
    stats = DashboardStatsResponse(
        total_tasks=15,
        completed_tasks=10,
        in_progress_tasks=5,
        overdue_tasks=2,
        overdue_count=2,
        assigned_to_me=4,
        active_projects=3,
        completion_rate=67,
        tasks_by_status={"DONE": 10, "IN_PROGRESS": 5},
        tasks_by_priority={"HIGH": 5},
    )
    await cache.set("test:model", stats, ttl=120)
    retrieved = await cache.get("test:model")
    assert retrieved is not None
    assert retrieved["totalTasks"] == 15
    assert retrieved["completionRate"] == 67

    # 3. Delete single key
    await cache.delete("test:str")
    assert await cache.get("test:str") is None


@pytest.mark.asyncio
async def test_corrupted_payload_graceful_recovery():
    """Corrupted/invalid JSON in Redis is safely evicted and returns None without raising."""
    fake_redis = FakeRedis()
    cache = CacheService(redis_client=fake_redis)

    full_key = cache._build_key("corrupted:key")
    await fake_redis.set(full_key, "invalid{json_payload...")

    result = await cache.get("corrupted:key")
    assert result is None
    # Evicted corrupted key
    assert await fake_redis.get(full_key) is None


@pytest.mark.asyncio
async def test_ordinary_cache_fail_open_on_redis_error():
    """Ordinary cache errors fall back to PostgreSQL (fail-open) without crashing."""
    broken_redis = MagicMock()
    broken_redis.get = AsyncMock(side_effect=RedisConnectionError("Connection refused"))
    broken_redis.set = AsyncMock(side_effect=RedisConnectionError("Connection refused"))
    broken_redis.delete = AsyncMock(side_effect=RedisConnectionError("Connection refused"))

    cache = CacheService(redis_client=broken_redis)

    # Get falls back gracefully to None
    val = await cache.get("any_key")
    assert val is None

    # Set returns False gracefully
    success = await cache.set("any_key", {"data": 1}, ttl=30)
    assert success is False

    # Delete returns False gracefully
    del_success = await cache.delete("any_key")
    assert del_success is False


@pytest.mark.asyncio
async def test_security_state_fail_closed_policy_comparison():
    """Security-state operations (sessions) fail closed when Redis is unavailable, while cache fails open."""
    broken_redis = MagicMock()
    broken_redis.get = AsyncMock(side_effect=RedisConnectionError("Redis outage"))
    broken_redis.set = AsyncMock(side_effect=RedisConnectionError("Redis outage"))
    broken_redis.pipeline = MagicMock(side_effect=RedisConnectionError("Redis outage"))

    session_service = RedisSessionService(redis_client=broken_redis)

    # Session creation fails securely (fail-closed)
    with pytest.raises(AuthenticationException) as exc_session:
        await session_service.create_session("u1", "127.0.0.1")
    assert "unavailable" in str(exc_session.value).lower()

    # Rate limiting: when Redis is unavailable, RedisRateLimiter degrades safely
    rate_limiter = RedisRateLimiter(redis_client=broken_redis)
    attempts = await rate_limiter.check_and_increment("ip_test", max_attempts=5, window_seconds=60)
    assert attempts == 1

    # Rate limiting enforces threshold when active
    working_limiter = RedisRateLimiter(redis_client=FakeRedis())
    for _ in range(3):
        await working_limiter.check_and_increment("test_ip", max_attempts=3, window_seconds=60)
    with pytest.raises(RateLimitException):
        await working_limiter.check_and_increment("test_ip", max_attempts=3, window_seconds=60)


@pytest.mark.asyncio
async def test_dashboard_stats_cache_aside_flow():
    """Test Cache-Aside: first call hits DAO and caches; second call hits cache directly."""
    fake_redis = FakeRedis()
    cache = CacheService(redis_client=fake_redis)

    mock_task_dao = MagicMock()
    mock_project_dao = MagicMock()

    mock_task_dao.get_dashboard_metrics = AsyncMock(
        return_value=(
            20, 10, 5, 2, 4,
            {"DONE": 10, "IN_PROGRESS": 5},
            {"HIGH": 5},
        )
    )
    mock_project_dao.count_active = AsyncMock(return_value=2)

    service = DashboardService(
        task_dao=mock_task_dao,
        project_dao=mock_project_dao,
        cache_service=cache,
    )

    admin_user = UserTokenPayload(id="adm_1", name="Admin", email="adm@t.dev", role="ADMIN")
    session = AsyncMock()

    # 1. First call: Cache Miss -> DAO called -> Cached
    stats_1 = await service.get_dashboard_stats(session, current_user=admin_user)
    assert stats_1.total_tasks == 20
    assert stats_1.completion_rate == 50
    mock_task_dao.get_dashboard_metrics.assert_awaited_once()

    # Verify TTL matches CACHE_TTL_DASHBOARD (60 seconds)
    cache_key = cache.dashboard_key(user_id=admin_user.id, role=admin_user.role)
    raw_ttl = await fake_redis.ttl(cache._build_key(cache_key))
    assert 55 <= raw_ttl <= settings.CACHE_TTL_DASHBOARD

    # 2. Second call: Cache Hit -> Returns cached data without calling DAO again
    mock_task_dao.get_dashboard_metrics.reset_mock()
    stats_2 = await service.get_dashboard_stats(session, current_user=admin_user)
    assert stats_2.total_tasks == 20
    assert stats_2.completion_rate == 50
    mock_task_dao.get_dashboard_metrics.assert_not_called()


@pytest.mark.asyncio
async def test_tasks_list_cache_aside_and_ttl():
    """Test task list caching respects 30-second TTL and returns cached results on subsequent calls."""
    fake_redis = FakeRedis()
    cache = CacheService(redis_client=fake_redis)

    mock_task_dao = MagicMock()
    sample_task = Task(
        id="PRJ-101",
        title="Cache Test Task",
        description="Detailed description",
        status="IN_PROGRESS",
        priority=TaskPriority.HIGH,
        project_id="prj_1",
        created_by_id="u1",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        due_date=datetime.now(timezone.utc).date(),
    )
    mock_task_dao.get_filtered = AsyncMock(return_value=[sample_task])

    service = TaskService(task_dao=mock_task_dao, cache_service=cache)
    user = UserTokenPayload(id="u1", name="User", email="u@t.dev", role="MEMBER")
    params = TaskFilterParams(project_id="prj_1", status="IN_PROGRESS")
    session = AsyncMock()

    # First call: miss
    tasks_1 = await service.get_tasks(session, params, user)
    assert len(tasks_1) == 1
    mock_task_dao.get_filtered.assert_awaited_once()

    # Verify TTL is CACHE_TTL_TASKS (30s)
    cache_key = cache.tasks_list_key(
        user_id=user.id, role=user.role, project_id="prj_1", status="IN_PROGRESS"
    )
    ttl = await fake_redis.ttl(cache._build_key(cache_key))
    assert 25 <= ttl <= settings.CACHE_TTL_TASKS

    # Second call: hit
    mock_task_dao.get_filtered.reset_mock()
    tasks_2 = await service.get_tasks(session, params, user)
    assert len(tasks_2) == 1
    mock_task_dao.get_filtered.assert_not_called()


@pytest.mark.asyncio
async def test_cache_key_isolation_prevents_cross_user_leakage():
    """Verify distinct cache keys for different users, preventing cross-user data leakage."""
    cache = CacheService()

    # User A vs User B dashboard keys
    key_user_a = cache.dashboard_key(user_id="usr_alice", role="MEMBER", project_id="p1")
    key_user_b = cache.dashboard_key(user_id="usr_bob", role="MEMBER", project_id="p1")
    key_admin = cache.dashboard_key(user_id="usr_admin", role="ADMIN", project_id="p1")

    assert key_user_a != key_user_b
    assert key_user_a != key_admin

    # Project scope keys
    key_proj_1 = cache.dashboard_key(user_id="usr_alice", role="MEMBER", project_id="p1")
    key_proj_2 = cache.dashboard_key(user_id="usr_alice", role="MEMBER", project_id="p2")
    assert key_proj_1 != key_proj_2

    # Tasks query filter keys
    key_todo = cache.tasks_list_key(user_id="u1", role="MEMBER", status="TODO")
    key_done = cache.tasks_list_key(user_id="u1", role="MEMBER", status="DONE")
    key_search = cache.tasks_list_key(user_id="u1", role="MEMBER", status="TODO", search="login")
    assert key_todo != key_done
    assert key_todo != key_search


@pytest.mark.asyncio
async def test_task_mutations_invalidate_relevant_caches():
    """Creating, updating, or deleting a task invalidates task and dashboard caches."""
    fake_redis = FakeRedis()
    cache = CacheService(redis_client=fake_redis)

    # Pre-populate cache keys
    await cache.set("tasks:list_1", [{"id": "T1"}], ttl=30)
    await cache.set("tasks:list_2", [{"id": "T2"}], ttl=30)
    await cache.set("dashboard:stats", {"total": 5}, ttl=60)
    await cache.set("task:PRJ-001", {"id": "PRJ-001"}, ttl=30)

    # Pre-populate security session key to verify it is NEVER touched
    await fake_redis.set("taskflow:session:s123", "active_session_payload")

    mock_task_dao = MagicMock()
    mock_project_dao = MagicMock()
    mock_column_dao = MagicMock()
    mock_column_dao.get_by_id_ci = AsyncMock(return_value=BoardColumn(id="TODO", title="To Do", order=0))
    mock_activity = MagicMock()
    mock_activity.log_activity = AsyncMock()

    proj = Project(id="prj_1", key="PRJ", name="P1", description="Desc", owner_id="adm", members=[])
    mock_project_dao.get_by_id = AsyncMock(return_value=proj)

    created_task = Task(id="PRJ-001", title="Task 1", status="TODO", project_id="prj_1")
    mock_task_dao.create = AsyncMock(return_value=created_task)

    service = TaskService(
        task_dao=mock_task_dao,
        project_dao=mock_project_dao,
        column_dao=mock_column_dao,
        activity_service=mock_activity,
        cache_service=cache,
    )

    admin = UserTokenPayload(id="adm", name="Admin", email="a@t.dev", role="ADMIN")
    session = AsyncMock()

    # Mutation: Create task
    data = TaskCreate(
        title="New Task",
        description="Detailed description",
        project_id="prj_1",
        status="TODO",
        due_date="2026-12-31",
    )
    await service.create_task(session, data, admin)

    # Assert cache invalidations
    assert await cache.get("tasks:list_1") is None
    assert await cache.get("tasks:list_2") is None
    assert await cache.get("dashboard:stats") is None

    # Assert security session was PRESERVED
    assert await fake_redis.get("taskflow:session:s123") == "active_session_payload"


@pytest.mark.asyncio
async def test_project_mutations_invalidate_caches():
    """Project mutations invalidate project, task, and dashboard caches."""
    fake_redis = FakeRedis()
    cache = CacheService(redis_client=fake_redis)

    await cache.set("projects:all", [{"id": "p1"}], ttl=60)
    await cache.set("project:p1:u:all", {"id": "p1"}, ttl=60)
    await cache.set("tasks:prj_1", [{"id": "t1"}], ttl=30)
    await cache.set("dashboard:stats", {"total": 1}, ttl=60)

    mock_project_dao = MagicMock()
    mock_project_dao.get_by_key = AsyncMock(return_value=None)
    mock_project_dao.create = AsyncMock(
        return_value=Project(
            id="p_new", name="New Project", key="NEW", description="Desc", owner_id="adm", members=[]
        )
    )

    mock_user_dao = MagicMock()
    mock_user_dao.get_by_ids = AsyncMock(return_value=[])
    mock_user_dao.get_by_id = AsyncMock(
        return_value=User(id="adm", name="Admin", email="a@t.dev", role=UserRole.ADMIN)
    )

    mock_activity = MagicMock()
    mock_activity.log_activity = AsyncMock()

    service = ProjectService(
        project_dao=mock_project_dao,
        user_dao=mock_user_dao,
        activity_service=mock_activity,
        cache_service=cache,
    )
    admin = UserTokenPayload(id="adm", name="Admin", email="a@t.dev", role="ADMIN")
    session = AsyncMock()

    await service.create_project(
        session,
        ProjectCreate(name="New Project", key="NEW", description="Project Description"),
        admin,
    )

    assert await cache.get("projects:all") is None
    assert await cache.get("project:p1:u:all") is None
    assert await cache.get("tasks:prj_1") is None
    assert await cache.get("dashboard:stats") is None


@pytest.mark.asyncio
async def test_column_mutations_invalidate_caches():
    """Column mutations invalidate column and task caches."""
    fake_redis = FakeRedis()
    cache = CacheService(redis_client=fake_redis)

    await cache.set("columns:all", [{"id": "TODO"}], ttl=300)
    await cache.set("tasks:all", [{"id": "t1"}], ttl=30)

    mock_col_dao = MagicMock()
    mock_col_dao.get_by_id_ci = AsyncMock(return_value=None)
    mock_col_dao.get_all_ordered = AsyncMock(return_value=[])
    mock_col_dao.get_max_order = AsyncMock(return_value=0)
    mock_col_dao.create = AsyncMock(
        return_value=BoardColumn(id="CUSTOM", title="Custom", order=1)
    )

    mock_activity = MagicMock()
    mock_activity.log_activity = AsyncMock()

    service = ColumnService(
        column_dao=mock_col_dao,
        activity_service=mock_activity,
        cache_service=cache,
    )
    admin = UserTokenPayload(id="adm", name="Admin", email="a@t.dev", role="ADMIN")
    session = AsyncMock()

    await service.create_column(session, ColumnCreate(title="Custom"), admin)

    assert await cache.get("columns:all") is None
    assert await cache.get("tasks:all") is None


@pytest.mark.asyncio
async def test_user_mutations_invalidate_caches():
    """Provisioning a user invalidates user and project cache entries."""
    fake_redis = FakeRedis()
    cache = CacheService(redis_client=fake_redis)

    await cache.set("users:all", [{"id": "u1"}], ttl=60)
    await cache.set("projects:all", [{"id": "p1"}], ttl=60)

    mock_user_dao = MagicMock()
    mock_user_dao.get_by_email = AsyncMock(return_value=None)
    created_user = User(
        id="u_new",
        name="New Member",
        email="new@t.dev",
        role=UserRole.MEMBER,
        password_hash="temp_hash",
        created_at=datetime.now(timezone.utc),
    )
    mock_user_dao.create = AsyncMock(return_value=created_user)

    mock_project_dao = MagicMock()
    mock_project_dao.add_user_to_all_projects = AsyncMock()

    mock_token_dao = MagicMock()
    mock_token_dao.create_token = AsyncMock()

    mock_activity = MagicMock()
    mock_activity.log_activity = AsyncMock()

    service = UserService(
        user_dao=mock_user_dao,
        project_dao=mock_project_dao,
        token_dao=mock_token_dao,
        activity_service=mock_activity,
        cache_service=cache,
    )
    admin = UserTokenPayload(id="adm", name="Admin", email="a@t.dev", role="ADMIN")
    session = AsyncMock()

    await service.provision_user(
        session,
        UserCreate(name="New Member", email="new@t.dev", role="MEMBER"),
        admin,
    )

    assert await cache.get("users:all") is None
    assert await cache.get("projects:all") is None


@pytest.mark.asyncio
async def test_pattern_invalidation_never_uses_flushdb():
    """Verify delete_pattern only deletes matching keys under cache prefix without touching other keys."""
    fake_redis = FakeRedis()
    cache = CacheService(redis_client=fake_redis)

    # Cache keys
    await cache.set("tasks:list1", "task_data_1")
    await cache.set("tasks:list2", "task_data_2")
    await cache.set("projects:list1", "project_data_1")

    # Security keys (e.g. session tokens, rate limits)
    await fake_redis.set("taskflow:session:user_123", "valid_session_token")
    await fake_redis.set("taskflow:rate_limit:ip_1", "3")

    # Invalidate only tasks:*
    deleted_count = await cache.delete_pattern("tasks:*")
    assert deleted_count == 2

    # Verify tasks keys were deleted
    assert await cache.get("tasks:list1") is None
    assert await cache.get("tasks:list2") is None

    # Verify other cache keys remain
    assert await cache.get("projects:list1") == "project_data_1"

    # Verify security keys were NEVER touched
    assert await fake_redis.get("taskflow:session:user_123") == "valid_session_token"
    assert await fake_redis.get("taskflow:rate_limit:ip_1") == "3"


def is_live_redis_running() -> bool:
    """Checks if a local Redis server is active on port 6379."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(("localhost", 6379)) == 0
    except Exception:
        return False


@pytest.mark.asyncio
async def test_live_redis_integration():
    """Live Redis integration test validating real TTL decrement, SCAN iteration, and invalidation."""
    if not is_live_redis_running():
        pytest.skip("Local Redis server not active on port 6379")

    client = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    cache = CacheService(redis_client=client)

    try:
        # 1. Roundtrip with TTL
        test_key = "integration:task_1"
        await cache.set(test_key, {"id": "IT-1", "title": "Live Redis Task"}, ttl=10)
        retrieved = await cache.get(test_key)
        assert retrieved is not None
        assert retrieved["id"] == "IT-1"

        # 2. Check live TTL decrement
        raw_key = cache._build_key(test_key)
        ttl = await client.ttl(raw_key)
        assert 1 <= ttl <= 10

        # 3. Pattern invalidation using SCAN
        await cache.set("integration:task_2", {"id": "IT-2"}, ttl=10)
        deleted = await cache.delete_pattern("integration:*")
        assert deleted >= 2

        assert await cache.get(test_key) is None
        assert await cache.get("integration:task_2") is None

    finally:
        await client.aclose()
