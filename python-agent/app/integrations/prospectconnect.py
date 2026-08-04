from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import jwt
import requests

from app.cache import cache
from app.config import settings
from app.memory import integration_store

# Known-read endpoints, safe to cache. Deliberately excludes /contact/upsert
# (the only write path through this module) by simply not listing it here —
# no special-casing needed at any call site.
_CACHEABLE_PATHS = {
    "/contact/search/contact",
    "/contact/search/contact-by-ids",
    "/deal/getDealsByBusinessId",
    "/note/getNotes",
    "/account/fetch-account-list",
    "/quotes/getQuotes",
    "/tag/fetchTagList",
}


def _mint_service_token(user_id: str, organization_id: str) -> str:
    """A short-lived JWT this process signs itself (shared JWT_SECRET with the
    NestJS backend) so the native CRM fallback below can call back into the
    backend's own JwtAuthGuard-protected /crm/* routes — the same
    bridge-token pattern the backend already uses for its own internal calls
    (e.g. dashboard.service.ts's `this.jwt.sign({sub: userId}, {expiresIn:
    '5m'})`), just minted from this side instead.
    """
    payload = {
        "sub": user_id or "system",
        "organizationId": organization_id,
        "roles": ["service"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def resolve_credentials(organization_id: str | None = None, user_id: str = "") -> tuple[str, str]:
    """Returns (api_root, api_key) for wherever this org's CRM data lives.

    Three tiers, in order:
    1. An external CRM connected via the frontend's Integrations page for
       this specific org (Mongo-backed, can change at runtime).
    2. The static .env global fallback (pre-multi-tenancy behavior,
       preserved for callers with no organization_id — e.g. the scheduled
       report context).
    3. **Native fallback**: if organization_id is known and neither of the
       above is configured, target this app's own backend at
       `{backend_url}/crm`, authenticating with a short-lived self-signed
       JWT (see _mint_service_token) instead of a static api_key — every org
       gets a working CRM without connecting anything external. The `api_key`
       returned here is the literal `Authorization` header value (see
       post_json/post below, which send it unprefixed) — for this tier it's
       `"Bearer <token>"`, which is exactly what the backend's passport-jwt
       strategy expects, so no other code in this module needs to change.

    api_root is normalized to the bare scheme+host for tiers 1-2 — resource
    paths (/contact/..., /deal/..., /note/..., ...) are appended by each
    tool, regardless of whether the stored base URL includes a sub-path.
    """
    base_url = integration_store.get_base_url("crm", organization_id) or settings.crm_base_url
    api_key = integration_store.get_api_key("crm", organization_id) or settings.crm_api_key
    if base_url:
        parsed = urlparse(base_url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        return base_url, api_key

    if organization_id:
        token = _mint_service_token(user_id, organization_id)
        return f"{settings.backend_url}/crm", f"Bearer {token}"

    return "", ""


def post_json(api_root: str, api_key: str, path: str, payload: dict):
    """Like post(), but returns the parsed JSON body and raises on failure
    instead of returning a human-readable error string — for callers (e.g.
    the RAG sync job) that need structured data rather than LLM-ready text.

    Read-only endpoints (see _CACHEABLE_PATHS) are cached briefly — CRM data
    is shared/business-wide (not per-user), so this speeds up both repeated
    lookups within one agentic turn and lookups across different users.
    """
    cacheable = path in _CACHEABLE_PATHS
    key = cache.cache_key(f"crm:{api_root}", path, payload) if cacheable else None
    if key is not None:
        hit = cache.get_json(key)
        if hit is not None:
            return hit

    url = f"{api_root.rstrip('/')}{path}"
    # ProspectConnect's auth docs specify the raw key in Authorization,
    # with no "Bearer " scheme prefix.
    response = requests.post(url, headers={"Authorization": api_key}, json=payload, timeout=15)
    response.raise_for_status()
    body = response.json()

    if key is not None:
        cache.set_json(key, body, settings.crm_cache_ttl_seconds)
    return body


def post(api_root: str, api_key: str, path: str, payload: dict) -> str:
    try:
        return str(post_json(api_root, api_key, path, payload))
    except requests.RequestException as exc:
        response = getattr(exc, "response", None)
        if response is not None:
            snippet = response.text[:300] or "(empty body)"
            return f"CRM request failed ({response.status_code}) at {api_root.rstrip('/')}{path}: {snippet}"
        return f"CRM request failed: {exc}"
    except ValueError:
        return f"CRM returned a non-JSON response at {api_root.rstrip('/')}{path}."