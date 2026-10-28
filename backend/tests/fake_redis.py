"""In-memory Redis test double for testing sessions, rate limiting, and token rotation."""

import time
from typing import Dict, Optional, Set


class FakePipeline:
    """Asynchronous pipeline test double for atomic operations."""

    def __init__(self, fake_redis: "FakeRedis") -> None:
        self.fake_redis = fake_redis
        self.commands = []

    def incr(self, key: str) -> "FakePipeline":
        self.commands.append(("incr", key))
        return self

    def ttl(self, key: str) -> "FakePipeline":
        self.commands.append(("ttl", key))
        return self

    async def execute(self):
        results = []
        for cmd, key in self.commands:
            if cmd == "incr":
                results.append(await self.fake_redis.incr(key))
            elif cmd == "ttl":
                results.append(await self.fake_redis.ttl(key))
        return results

    async def __aenter__(self) -> "FakePipeline":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        pass


class FakeRedis:
    """In-memory async Redis implementation for deterministic test runs."""

    def __init__(self) -> None:
        self._data: Dict[str, str] = {}
        self._expires: Dict[str, float] = {}
        self._sets: Dict[str, Set[str]] = {}

    def _is_expired(self, key: str) -> bool:
        if key in self._expires and time.time() > self._expires[key]:
            self._data.pop(key, None)
            self._expires.pop(key, None)
            self._sets.pop(key, None)
            return True
        return False

    async def get(self, key: str) -> Optional[str]:
        if self._is_expired(key):
            return None
        return self._data.get(key)

    async def set(
        self,
        key: str,
        value: str,
        ex: Optional[int] = None,
        px: Optional[int] = None,
        nx: bool = False,
    ) -> bool:
        self._is_expired(key)
        if nx and key in self._data:
            return False
        self._data[key] = str(value)
        if ex is not None:
            self._expires[key] = time.time() + ex
        elif px is not None:
            self._expires[key] = time.time() + (px / 1000.0)
        return True

    async def delete(self, *keys: str) -> int:
        count = 0
        for k in keys:
            if k in self._data or k in self._sets:
                self._data.pop(k, None)
                self._expires.pop(k, None)
                self._sets.pop(k, None)
                count += 1
        return count

    async def ttl(self, key: str) -> int:
        if self._is_expired(key) or (key not in self._data and key not in self._sets):
            return -2
        if key not in self._expires:
            return -1
        remaining = int(self._expires[key] - time.time())
        return max(0, remaining)

    async def expire(self, key: str, seconds: int) -> bool:
        if self._is_expired(key) or (key not in self._data and key not in self._sets):
            return False
        self._expires[key] = time.time() + seconds
        return True

    async def incr(self, key: str) -> int:
        self._is_expired(key)
        curr = int(self._data.get(key, 0))
        curr += 1
        self._data[key] = str(curr)
        return curr

    async def sadd(self, key: str, *members: str) -> int:
        self._is_expired(key)
        if key not in self._sets:
            self._sets[key] = set()
        prev_len = len(self._sets[key])
        self._sets[key].update(members)
        return len(self._sets[key]) - prev_len

    async def smembers(self, key: str) -> Set[str]:
        if self._is_expired(key):
            return set()
        return set(self._sets.get(key, set()))

    def pipeline(self, transaction: bool = True) -> FakePipeline:
        return FakePipeline(self)

    async def scan_iter(self, match: Optional[str] = None, count: Optional[int] = None):
        """Asynchronously iterates through keys matching glob pattern."""
        import fnmatch
        all_keys = set(self._data.keys()) | set(self._sets.keys())
        for key in list(all_keys):
            if not self._is_expired(key):
                if match is None or fnmatch.fnmatch(key, match):
                    yield key

    async def keys(self, pattern: str = "*") -> list[str]:
        """Returns list of all active keys matching glob pattern."""
        import fnmatch
        all_keys = set(self._data.keys()) | set(self._sets.keys())
        matched = []
        for key in list(all_keys):
            if not self._is_expired(key):
                if fnmatch.fnmatch(key, pattern):
                    matched.append(key)
        return matched

    async def ping(self) -> bool:
        """Returns True if fake connection is active."""
        return True

    async def aclose(self) -> None:
        pass

