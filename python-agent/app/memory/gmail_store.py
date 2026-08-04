from datetime import datetime, timedelta

import requests

from app.config import settings
from app.memory.mongo_client import get_db

TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"


def get_connection(user_id: str) -> dict | None:
    # A user may have several connected mailboxes; the backend's Gmail
    # Account Management UI lets them pick which one is active (see
    # backend/src/gmail/gmail.service.ts setActive) — that's the one the
    # agent acts as. Same convention as app.memory.outlook_store.
    return get_db().gmail_connections.find_one({"userId": user_id, "isActive": True})


def get_valid_access_token(user_id: str) -> str | None:
    """Returns a live Gmail API access token for this user, refreshing if
    needed. Tokens are written by the NestJS backend after the OAuth
    callback; this only reads/refreshes them (backend owns the initial
    exchange since it holds the redirect flow) — identical division of
    responsibility to outlook_store.py."""
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
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "grant_type": "refresh_token",
            "refresh_token": connection["refreshToken"],
        },
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()

    new_access_token = payload["access_token"]
    # Google's refresh response often omits refresh_token (it's long-lived
    # and unchanged) — keep the existing one rather than overwriting with
    # nothing, same defensive default outlook_store.py uses for MS.
    new_refresh_token = payload.get("refresh_token", connection["refreshToken"])
    new_expires_at = datetime.utcnow() + timedelta(seconds=payload.get("expires_in", 3600))

    get_db().gmail_connections.update_one(
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
