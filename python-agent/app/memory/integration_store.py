import base64
import json

from app.encryption import decrypt
from app.memory.mongo_client import get_db


def get_api_key(provider: str, organization_id: str | None = None) -> str | None:
    """Reads a per-provider API key saved via the NestJS backend's

    Integrations page (POST /integrations/:provider/connect writes it to the
    same "integration_credentials" Mongo collection — one doc per
    (organizationId, provider) since multi-tenant Phase 1). The backend owns
    writes; this only reads, mirroring the outlook_store.py pattern for OAuth
    tokens.

    organization_id is opt-in, not required: passing it scopes the lookup to
    that org's own credential doc (used by prospectconnect.py's CRM
    resolution, which has an org in context). Callers that don't pass it
    (anthropic_client.py/groq_client.py's `_resolve_api_key`, which don't
    thread an org through their many call sites yet) keep the exact
    pre-Phase-1 behavior — first matching doc for that provider, regardless
    of org — rather than being silently broken by a filter they don't know to
    pass. Making those two properly org-aware is out of scope here; it needs
    threading organization_id through every anthropic_client.py entry point,
    not just the CRM path this pass is about.
    """
    query: dict = {"provider": provider}
    if organization_id is not None:
        query["organizationId"] = organization_id
    doc = get_db().integration_credentials.find_one(query)
    return doc.get("apiKey") if doc else None


def get_base_url(provider: str, organization_id: str | None = None) -> str | None:
    """Reads a per-provider base URL saved via the Integrations page (same

    "integration_credentials" doc as get_api_key — providers like CRM need
    both an endpoint and a key, unlike Anthropic which only needs a key). See
    get_api_key's docstring for the organization_id opt-in behavior.
    """
    query: dict = {"provider": provider}
    if organization_id is not None:
        query["organizationId"] = organization_id
    doc = get_db().integration_credentials.find_one(query)
    return doc.get("baseUrl") if doc else None


def get_credentials(provider: str, organization_id: str | None = None) -> dict | None:
    """Reads a custom (non-OAuth) integration's full connection — auth_type
    plus decrypted credentials plus base_url — for providers connected
    through the generic multi-auth-method flow (see
    backend/src/integrations/auth-methods.ts and
    IntegrationsService.connectWithAuth). Returns None if nothing is
    connected for this (provider, organization_id), or if the connection
    used the older apiKey-only shape (authType absent) — callers wanting
    that shape should use get_api_key/get_base_url above instead; this is
    specifically for bearer/basic/customHeaders-style connections, which
    have no meaningful single "apiKey".

    Unlike get_api_key/get_base_url, organization_id is effectively required
    in practice — every caller of this generic multi-auth path has an org in
    context (it's reached through an authenticated tool call), unlike
    anthropic_client.py's pre-multi-tenant global fallback.
    """
    query: dict = {"provider": provider}
    if organization_id is not None:
        query["organizationId"] = organization_id
    doc = get_db().integration_credentials.find_one(query)
    if not doc or not doc.get("authType"):
        return None
    return {
        "authType": doc["authType"],
        "baseUrl": doc.get("baseUrl"),
        "healthCheckPath": doc.get("healthCheckPath"),
        "credentials": json.loads(decrypt(doc["credentialsEncrypted"])),
    }


def build_auth_headers(auth_type: str, credentials: dict) -> dict:
    """Mirrors backend/src/integrations/auth-methods.ts's buildAuthHeaders
    exactly — any change there needs the same change here. Used by any tool
    calling a custom-connected provider's REST API on the org's behalf."""
    if auth_type in ("apiKey", "apiKeyBaseUrl"):
        header_name = credentials.get("headerName") or "X-Api-Key"
        return {header_name: credentials.get("apiKey", "")}
    if auth_type == "bearer":
        return {"Authorization": f"Bearer {credentials.get('bearerToken', '')}"}
    if auth_type == "basic":
        raw = f"{credentials.get('username', '')}:{credentials.get('password', '')}"
        encoded = base64.b64encode(raw.encode()).decode()
        return {"Authorization": f"Basic {encoded}"}
    if auth_type == "customHeaders":
        return credentials.get("headers", {})
    return {}
