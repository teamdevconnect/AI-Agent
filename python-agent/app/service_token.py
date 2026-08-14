"""Mints the short-lived self-signed JWT python-agent uses to call back into
the NestJS backend's own JwtAuthGuard-protected routes — the shared bridge
pattern used by app.integrations.prospectconnect (native CRM fallback),
app.integrations.integration_executor (Dynamic Executor bridge), and
app.billing.client (credit reserve/settle/release). Extracted here once
these reached three independent copies of the same ten lines; billing was
the trigger since duplicating it a third time crossed the "just inline it"
threshold this codebase otherwise favors for two-off duplication.
"""

from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings

_DEFAULT_TTL_MINUTES = 5


def mint_service_token(user_id: str, organization_id: str | None, ttl_minutes: int = _DEFAULT_TTL_MINUTES) -> str:
    """Signed with the shared JWT_SECRET so the backend's passport-jwt
    strategy accepts it exactly like a real user session token. `roles:
    ["service"]` marks it as an internal call for any route that cares to
    distinguish (none currently do — every bridge target so far is either
    unguarded by role or already fine with any authenticated caller)."""
    payload = {
        "sub": user_id or "system",
        "organizationId": organization_id,
        "roles": ["service"],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
