import hashlib
import json

from app.cache.redis_client import get_client


def cache_key(namespace: str, path: str, payload: dict) -> str:
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    return f"{namespace}:{path}:{digest}"


def get_json(key: str):
    # Fail open — a Redis hiccup must degrade to a cache miss, never break
    # the caller (every caller falls back to the live source on a miss).
    try:
        raw = get_client().get(key)
        return json.loads(raw) if raw is not None else None
    except Exception:
        return None


def set_json(key: str, value, ttl_seconds: int) -> None:
    try:
        get_client().set(key, json.dumps(value), ex=ttl_seconds)
    except Exception:
        pass
