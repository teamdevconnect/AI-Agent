<<<<<<< HEAD
import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def graph_get(path: str, access_token: str, params: dict | None = None) -> dict:
=======
import hashlib

import requests

from app.cache import cache
from app.config import settings

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# Read endpoints worth caching. Outlook data is per-user (unlike CRM's
# shared data), so the cache key below is scoped to the calling token.
_CACHEABLE_PATHS = {"/me/messages", "/me/contacts"}


def graph_get(path: str, access_token: str, params: dict | None = None) -> dict:
    cacheable = path in _CACHEABLE_PATHS
    key = None
    if cacheable:
        # Hash the token rather than using it raw as part of the key — it's
        # a bearer credential and Redis keys are visible via KEYS/MONITOR/logs.
        token_hash = hashlib.sha256(access_token.encode()).hexdigest()[:16]
        key = cache.cache_key(f"outlook:{token_hash}", path, params or {})
        hit = cache.get_json(key)
        if hit is not None:
            return hit

>>>>>>> 6a60a8648 (Initial AI Agent source code)
    response = requests.get(
        f"{GRAPH_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
        timeout=15,
    )
    response.raise_for_status()
<<<<<<< HEAD
    return response.json()
=======
    body = response.json()

    if key is not None:
        cache.set_json(key, body, settings.outlook_cache_ttl_seconds)
    return body
>>>>>>> 6a60a8648 (Initial AI Agent source code)


def graph_post(path: str, access_token: str, json_body: dict) -> dict:
    response = requests.post(
        f"{GRAPH_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        json=json_body,
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def list_recent_messages(access_token: str, top: int = 50) -> list[dict]:
    """Recent inbox messages for the RAG business sync job — includes `id`
    (needed for a deterministic Qdrant point id) alongside the fields
    outlook_tool.py already selects for on-demand chat lookups."""
    data = graph_get(
        "/me/messages",
        access_token,
        params={
            "$top": top,
            "$orderby": "receivedDateTime desc",
            "$select": "id,subject,from,receivedDateTime,bodyPreview",
        },
    )
    return data.get("value", [])
