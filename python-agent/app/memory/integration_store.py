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
