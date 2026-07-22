from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Protocol

from app.core.logging import get_logger

logger = get_logger(__name__)


class CacheBackend(Protocol):
    async def get(self, key: str) -> dict[str, Any] | None: ...

    async def set(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None: ...

    async def ping(self) -> bool: ...


class InMemoryCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[float, str]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> dict[str, Any] | None:
        async with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            expires_at, payload = item
            if expires_at < time.time():
                del self._store[key]
                return None
            return json.loads(payload)

    async def set(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        async with self._lock:
            self._store[key] = (time.time() + ttl_seconds, json.dumps(value))

    async def ping(self) -> bool:
        return True


class RedisCache:
    def __init__(self, redis_client: Any) -> None:
        self._redis = redis_client

    async def get(self, key: str) -> dict[str, Any] | None:
        try:
            payload = await self._redis.get(key)
        except Exception:
            logger.warning("redis_get_failed", key=key)
            return None
        if not payload:
            return None
        return json.loads(payload)

    async def set(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        try:
            await self._redis.set(key, json.dumps(value), ex=ttl_seconds)
        except Exception:
            logger.warning("redis_set_failed", key=key)

    async def ping(self) -> bool:
        try:
            return bool(await self._redis.ping())
        except Exception:
            logger.warning("redis_ping_failed")
            return False


def geohash_cache_key(lat: float, lon: float, precision: int = 3) -> str:
    """Round coordinates for cache locality (~0.001 deg at precision 3)."""
    return f"env:{round(lat, precision)}:{round(lon, precision)}"
