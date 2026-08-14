"""Bridge to the NestJS billing module (backend/src/billing) — no wallet
math, margin formula, or payment-gateway logic lives here; all of that
stays server-side in Node, the single source of truth for money. This
module only mints a short-lived service JWT (see app.service_token) and
calls the three routes routes/chat.py needs around every chat turn.

Reserve is called BEFORE run_agent() — its 402 is the actual hard-stop
enforcement point (a structural early return, not a downstream check).
Settle/release are called after, exactly one of the two depending on
whether run_agent() succeeded or raised.
"""

import logging

import requests
from fastapi import HTTPException

from app.config import settings
from app.service_token import mint_service_token

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 15


class InsufficientCreditsError(Exception):
    """Raised by reserve() on a 402 from the backend — routes/chat.py
    catches this and returns/streams a Haive-worded error without ever
    calling run_agent()."""

    def __init__(self, message: str, available_credits: int = 0, required_credits: int = 0):
        super().__init__(message)
        self.message = message
        self.available_credits = available_credits
        self.required_credits = required_credits


def reserve(organization_id: str | None, user_id: str, request_id: str, conversation_id: str) -> dict:
    if not organization_id:
        # No org context (e.g. a system/internal call with no tenant) —
        # billing has nothing to scope to, so let the request proceed
        # unmetered rather than block a path that predates multi-tenant
        # billing entirely. Every real user-facing chat turn always has an
        # organization_id (see routes/chat.py's Depends(get_current_user)).
        return {"reservationId": "", "estimatedCredits": 0, "availableCredits": 0}

    token = mint_service_token(user_id, organization_id)
    try:
        response = requests.post(
            f"{settings.backend_url}/billing/credits/reserve",
            json={"requestId": request_id, "conversationId": conversation_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        # Fail-open on a billing-service outage: never let a Mongo/network
        # blip on the metering side take down chat entirely. This is the
        # one deliberate exception to "never call an LLM without reserving
        # first" — an unreachable billing backend is an infra incident, not
        # a customer's balance being exhausted.
        logger.error("Billing reserve() call failed (%s) — proceeding unmetered for this turn.", exc)
        return {"reservationId": "", "estimatedCredits": 0, "availableCredits": 0}

    if response.status_code == 402:
        body = response.json()
        raise InsufficientCreditsError(
            body.get("message", "Your Haive Credits are exhausted. Add credits or enable Auto Recharge to continue using Haive AI."),
            available_credits=body.get("availableCredits", 0),
            required_credits=body.get("requiredCredits", 0),
        )
    response.raise_for_status()
    return response.json()


def settle(organization_id: str | None, user_id: str, request_id: str) -> dict | None:
    if not organization_id:
        return None
    token = mint_service_token(user_id, organization_id)
    try:
        response = requests.post(
            f"{settings.backend_url}/billing/credits/settle",
            json={"requestId": request_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        logger.error("Billing settle() call failed for requestId=%s: %s", request_id, exc)
        return None


def release(organization_id: str | None, user_id: str, request_id: str) -> None:
    if not organization_id:
        return
    token = mint_service_token(user_id, organization_id)
    try:
        requests.post(
            f"{settings.backend_url}/billing/credits/release",
            json={"requestId": request_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        logger.error("Billing release() call failed for requestId=%s: %s", request_id, exc)


def to_http_exception(exc: InsufficientCreditsError) -> HTTPException:
    return HTTPException(
        status_code=402,
        detail={
            "code": "INSUFFICIENT_BALANCE",
            "message": exc.message,
            "availableCredits": exc.available_credits,
            "requiredCredits": exc.required_credits,
        },
    )
