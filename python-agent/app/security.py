import jwt
from fastapi import HTTPException, Request, status

from app.config import settings


def get_current_user(request: Request) -> dict:
    """Re-validates the JWT the backend already checked and forwarded.

    The agent is never openly callable: every route depends on this so a
    request without a valid backend-issued token is rejected here too.

    The backend now mints tokens with an `organizationId` claim (multi-tenant
    Phase 1) alongside the required `sub` — it flows through here unchanged
    since this returns the whole payload dict, so any route/tool that later
    needs to scope a query by tenant (CRM, documents, memory — see the
    roadmap's Phase 2+) can read `user["organizationId"]` with no security.py
    change needed. Short-lived internal tokens (e.g. the ones NestJS mints for
    the scheduled morning/EOD job, `{"sub": userId}`) have no organizationId —
    treat it as optional (`user.get("organizationId")`), never required, when
    consuming it.
    """
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = header[7:]
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc

    if "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token payload")
    return payload
