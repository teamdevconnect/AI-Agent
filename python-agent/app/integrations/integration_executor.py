"""Thin bridge to the NestJS Dynamic Executor (backend/src/integrations/
dynamic-executor.service.ts) — no auth-header building, URL templating, or
SSRF logic lives here; all of that stays server-side in Node so decrypted
credentials never leave that process. This module only mints a short-lived
service JWT (same pattern as prospectconnect.py's _mint_service_token) and
calls the two HTTP routes the two new AI tools need.
"""

from datetime import datetime, timedelta, timezone

import jwt
import requests

from app.config import settings

_TIMEOUT_SECONDS = 20


def _mint_service_token(organization_id: str, user_id: str = "") -> str:
    payload = {
        "sub": user_id or "system",
        "organizationId": organization_id,
        "roles": ["service"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def get_capabilities(organization_id: str, user_id: str = "", provider: str | None = None) -> list[dict]:
    """Calls GET /integrations/capabilities — what's connected and what
    resources/endpoints are configured for it (see
    IntegrationResourcesService.listCapabilities)."""
    token = _mint_service_token(organization_id, user_id)
    params = {"provider": provider} if provider else {}
    response = requests.get(
        f"{settings.backend_url}/integrations/capabilities",
        params=params,
        headers={"Authorization": f"Bearer {token}"},
        timeout=_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def execute(
    organization_id: str,
    provider: str,
    resource_key: str,
    endpoint_key: str,
    user_id: str = "",
    path_params: dict | None = None,
    query: dict | None = None,
    body: object | None = None,
) -> dict:
    """Calls POST /integrations/execute — the single generic entry point for
    running any configured endpoint on any connected provider (see
    DynamicExecutorService.execute). Returns the normalized
    {success, statusCode, data, error, message, ...} shape verbatim; the
    caller (integration_execute_tool.py) renders it into text for Claude."""
    token = _mint_service_token(organization_id, user_id)
    response = requests.post(
        f"{settings.backend_url}/integrations/execute",
        json={
            "provider": provider,
            "resourceKey": resource_key,
            "endpointKey": endpoint_key,
            "pathParams": path_params or {},
            "query": query or {},
            "body": body,
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=_TIMEOUT_SECONDS,
    )
    # 4xx from the executor itself (e.g. unknown resource/endpoint, missing
    # required param) still carries a useful Nest error body — surface that
    # instead of raising, so the tool can hand Claude a specific reason.
    if response.status_code >= 400:
        try:
            detail = response.json().get("message", response.text[:300])
        except ValueError:
            detail = response.text[:300]
        return {"success": False, "message": str(detail), "statusCode": response.status_code}
    return response.json()
