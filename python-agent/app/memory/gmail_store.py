from datetime import datetime, timedelta

import requests

from app.config import settings
from app.encryption import decrypt_token, encrypt
from app.memory.mongo_client import get_db

TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"


def get_connection(user_id: str) -> dict | None:
    # A user may have several connected mailboxes; the backend's Gmail
    # Account Management UI lets them pick which one is active (see
    # backend/src/gmail/gmail.service.ts setActive) — that's the one the
    # agent acts as. Same convention as app.memory.outlook_store, including
    # excluding needs_reauth connections (a prior refresh already
    # established the grant is dead — see _refresh below).
    return get_db().gmail_connections.find_one(
        {"userId": user_id, "isActive": True, "status": {"$ne": "needs_reauth"}}
    )


def get_valid_access_token(user_id: str) -> str | None:
    """Returns a live Gmail API access token for this user, refreshing if
    needed. Tokens are written by the NestJS backend after the OAuth
    callback; this only reads/refreshes them (backend owns the initial
    exchange since it holds the redirect flow) — identical division of
    responsibility to outlook_store.py, including returning None both when
    there's no connection and when its refresh grant has been revoked."""
    connection = get_connection(user_id)
    if not connection:
        return None

    if datetime.utcnow() >= connection["expiresAt"] - timedelta(seconds=60):
        connection = _refresh(connection)
        if connection is None:
            return None

    return decrypt_token(connection["accessToken"])


def _refresh(connection: dict) -> dict | None:
    response = requests.post(
        TOKEN_ENDPOINT,
        data={
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "grant_type": "refresh_token",
            "refresh_token": decrypt_token(connection["refreshToken"]),
        },
        timeout=10,
    )

    if response.status_code == 400 and response.json().get("error") == "invalid_grant":
        # Refresh token expired or revoked (user changed their Google
        # password, removed the app's access, etc.) — same permanent-failure
        # handling as outlook_store.py's _refresh.
        get_db().gmail_connections.update_one(
            {"userId": connection["userId"], "email": connection["email"]},
            {"$set": {"status": "needs_reauth"}},
        )
        return None

    response.raise_for_status()
    payload = response.json()

    new_access_token = payload["access_token"]
    # Google's refresh response often omits refresh_token (it's long-lived
    # and unchanged) — keep the existing one rather than overwriting with
    # nothing, same defensive default outlook_store.py uses for MS.
    new_refresh_token = payload.get("refresh_token", decrypt_token(connection["refreshToken"]))
    new_expires_at = datetime.utcnow() + timedelta(seconds=payload.get("expires_in", 3600))
    encrypted_access_token = encrypt(new_access_token)
    encrypted_refresh_token = encrypt(new_refresh_token)

    get_db().gmail_connections.update_one(
        {"userId": connection["userId"], "email": connection["email"]},
        {
            "$set": {
                "accessToken": encrypted_access_token,
                "refreshToken": encrypted_refresh_token,
                "expiresAt": new_expires_at,
                "status": "connected",
            }
        },
    )
    connection["accessToken"] = encrypted_access_token
    connection["refreshToken"] = encrypted_refresh_token
    connection["expiresAt"] = new_expires_at
    return connection
