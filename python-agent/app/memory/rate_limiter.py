"""Fixed-window rate limiting, used by app.tools.registry.execute_tool to cap
how often one caller can invoke one tool. Fail-open like app.cache.cache — a
Redis outage must never block a legitimate tool call, only real over-limit
traffic when Redis is actually reachable.
"""

from app.cache.redis_client import get_client


def allow(key: str, max_calls: int, window_seconds: int) -> bool:
    try:
        client = get_client()
        count = client.incr(key)
        if count == 1:
            client.expire(key, window_seconds)
        return count <= max_calls
    except Exception:
        return True
