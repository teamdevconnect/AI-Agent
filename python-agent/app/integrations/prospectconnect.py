from urllib.parse import urlparse

import requests

from app.config import settings
from app.memory import integration_store


def resolve_credentials() -> tuple[str, str]:
    """Returns (api_root, api_key) for the CRM connected via the frontend's

    Integrations page (Mongo-backed, can change at runtime without
    restarting this process), falling back to the static .env values.
    api_root is normalized to the bare scheme+host — resource paths
    (/contact/..., /deal/..., /note/..., ...) are appended by each tool,
    regardless of whether the stored base URL includes a sub-path.
    """
    base_url = integration_store.get_base_url("crm") or settings.crm_base_url
    api_key = integration_store.get_api_key("crm") or settings.crm_api_key
    if base_url:
        parsed = urlparse(base_url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
    return base_url, api_key


def post_json(api_root: str, api_key: str, path: str, payload: dict):
    """Like post(), but returns the parsed JSON body and raises on failure
    instead of returning a human-readable error string — for callers (e.g.
    the RAG sync job) that need structured data rather than LLM-ready text.
    """
    url = f"{api_root.rstrip('/')}{path}"
    # ProspectConnect's auth docs specify the raw key in Authorization,
    # with no "Bearer " scheme prefix.
    response = requests.post(url, headers={"Authorization": api_key}, json=payload, timeout=15)
    response.raise_for_status()
    return response.json()


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