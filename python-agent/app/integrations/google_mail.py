import hashlib

import requests

from app.cache import cache
from app.config import settings

GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

# Only the list call is cached — the per-message metadata fetches below are
# one HTTP call each (Gmail's list endpoint returns bare id/threadId pairs,
# unlike Graph's $select which returns full fields in one round trip), so
# caching just the list keeps repeated lookups from re-paying that N+1 cost
# within the TTL window at least for the "which messages exist" part.
_CACHEABLE_PATHS = {"/messages"}


def gmail_get(path: str, access_token: str, params: dict | None = None) -> dict:
    cacheable = path in _CACHEABLE_PATHS
    key = None
    if cacheable:
        token_hash = hashlib.sha256(access_token.encode()).hexdigest()[:16]
        key = cache.cache_key(f"gmail:{token_hash}", path, params or {})
        hit = cache.get_json(key)
        if hit is not None:
            return hit

    response = requests.get(
        f"{GMAIL_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
        timeout=15,
    )
    response.raise_for_status()
    body = response.json()

    if key is not None:
        cache.set_json(key, body, settings.outlook_cache_ttl_seconds)
    return body


def list_recent_messages(access_token: str, top: int = 10) -> list[dict]:
    """Recent inbox messages — id/subject/from/snippet. Gmail's list
    endpoint only returns {id, threadId}, so this fetches metadata for each
    message individually (no bulk $select equivalent exists in the Gmail
    API); `top` defaults lower than ms_graph.py's equivalent (50) to keep
    that N+1 cost bounded for on-demand chat lookups."""
    data = gmail_get("/messages", access_token, params={"maxResults": top, "q": "in:inbox"})
    refs = data.get("messages", [])

    results = []
    for ref in refs:
        detail = gmail_get(
            f"/messages/{ref['id']}",
            access_token,
            params={"format": "metadata", "metadataHeaders": ["Subject", "From"]},
        )
        headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}
        results.append(
            {
                "id": detail.get("id", ""),
                "subject": headers.get("Subject", ""),
                "from": headers.get("From", ""),
                "snippet": detail.get("snippet", ""),
            }
        )
    return results
