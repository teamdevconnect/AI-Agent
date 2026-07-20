from app.memory.mongo_client import get_db


def get_api_key(provider: str) -> str | None:
    """Reads a per-provider API key saved via the NestJS backend's

    Integrations page (POST /integrations/:provider/connect writes it to the
    same "integration_credentials" Mongo collection). The backend owns writes;
    this only reads, mirroring the outlook_store.py pattern for OAuth tokens.
    """
    doc = get_db().integration_credentials.find_one({"provider": provider})
    return doc.get("apiKey") if doc else None


def get_base_url(provider: str) -> str | None:
    """Reads a per-provider base URL saved via the Integrations page (same

    "integration_credentials" doc as get_api_key — providers like CRM need
    both an endpoint and a key, unlike Anthropic which only needs a key.
    """
    doc = get_db().integration_credentials.find_one({"provider": provider})
    return doc.get("baseUrl") if doc else None
