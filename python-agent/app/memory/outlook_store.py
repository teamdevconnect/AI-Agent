from datetime import datetime, timedelta

import requests

from app.config import settings
from app.memory.mongo_client import get_db

# "organizations" (not a specific tenant ID) so any franchise business's
# Microsoft 365 tenant can connect — this app is registered as multi-tenant
# in Azure AD, matching backend/src/outlook/outlook.service.ts.
TOKEN_ENDPOINT = "https://login.microsoftonline.com/organizations/oauth2/v2.0/token"
GRAPH_SCOPES = "offline_access User.Read Mail.Read Calendars.Read Contacts.Read"


def get_connection(user_id: str) -> dict | None:
    # A user may have several connected mailboxes; the backend's Outlook
    # Account Management UI lets them pick which one is active (see
    # backend/src/outlook/outlook.service.ts setActive) — that's the one
    # the agent acts as.
    return get_db().outlook_connections.find_one({"userId": user_id, "isActive": True})


def get_valid_access_token(user_id: str) -> str | None:
    """Returns a live Graph access token for this user, refreshing if needed.

    Tokens are written by the NestJS backend after the OAuth callback; this
    only reads/refreshes them (backend owns the initial exchange since it
    holds the redirect flow).
    """
    connection = get_connection(user_id)
    if not connection:
        return None

    if datetime.utcnow() >= connection["expiresAt"] - timedelta(seconds=60):
        connection = _refresh(connection)

    return connection["accessToken"]


def _refresh(connection: dict) -> dict:
    response = requests.post(
        TOKEN_ENDPOINT,
        data={
            "client_id": settings.ms_graph_client_id,
            "client_secret": settings.ms_graph_client_secret,
            "grant_type": "refresh_token",
            "refresh_token": connection["refreshToken"],
            "scope": GRAPH_SCOPES,
        },
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()

    new_access_token = payload["access_token"]
    new_refresh_token = payload.get("refresh_token", connection["refreshToken"])
    new_expires_at = datetime.utcnow() + timedelta(seconds=payload.get("expires_in", 3600))

    get_db().outlook_connections.update_one(
        {"userId": connection["userId"], "email": connection["email"]},
        {
            "$set": {
                "accessToken": new_access_token,
                "refreshToken": new_refresh_token,
                "expiresAt": new_expires_at,
            }
        },
    )
    connection["accessToken"] = new_access_token
    connection["refreshToken"] = new_refresh_token
    connection["expiresAt"] = new_expires_at
    return connection
