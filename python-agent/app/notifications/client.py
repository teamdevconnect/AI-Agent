"""Creates a notification via the NestJS backend's /notifications endpoint —
the one place python-agent calls the backend instead of the other way
around (see app.config.Settings.backend_url's comment for why: only the
backend owns the Socket.IO connection the frontend listens on, so live push
has to go through it).

Authenticates by minting a short-lived JWT for the target user with the
shared JWT_SECRET — same pattern backend/src/chat/chat.service.ts's
generateSystemConversation already uses for the scheduled report job, just
running in the other direction. The backend can't distinguish this from a
call the user's own session made, by design: a notification this mints is
always scoped to exactly the user named in the token, never an arbitrary id.

Fail-open: notification delivery is a nice-to-have on top of a workflow's
real result, never something that should make the workflow itself look
like it failed. Logs and returns None on any error.
"""

import logging
import time

import jwt
import requests

from app.config import settings

logger = logging.getLogger(__name__)

_TOKEN_TTL_SECONDS = 300


def notify(user_id: str, title: str, description: str, kind: str = "system", source: str | None = None) -> bool:
    if user_id in ("", "*"):
        # No real user to notify (e.g. shared/system-scoped autonomous runs —
        # see app.agent.autonomous's default user_id) — nothing to push to.
        return False

    try:
        token = jwt.encode(
            {"sub": user_id, "exp": int(time.time()) + _TOKEN_TTL_SECONDS},
            settings.jwt_secret,
            algorithm="HS256",
        )
        response = requests.post(
            f"{settings.backend_url}/notifications",
            json={"title": title, "description": description, "kind": kind, "source": source},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        response.raise_for_status()
        return True
    except Exception:
        logger.exception("Failed to create notification for user %s", user_id)
        return False
