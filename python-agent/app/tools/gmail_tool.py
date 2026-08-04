import requests

from app.config import settings
from app.integrations import google_mail
from app.memory import gmail_store

SPEC = {
    "name": "gmail_lookup",
    "description": "Read the signed-in user's Gmail inbox via the Gmail API.",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}

# Gmail has no single "contacts" endpoint the same way Microsoft Graph does
# (Google People API is a separate, differently-scoped product) — this tool
# is deliberately narrower than outlook_tool.py (emails only), not padded to
# match its shape artificially.


def run(tool_input: dict, context: dict) -> str:
    if not settings.google_client_id:
        placeholder = [{"id": "msg-1", "from": "client@example.com", "subject": "Following up on our proposal"}]
        return str(placeholder)

    token = gmail_store.get_valid_access_token(context.get("user_id", ""))
    if not token:
        return (
            "This user hasn't connected Gmail yet. Ask them to click "
            "'Connect Gmail' in the app to authorize access to their mailbox."
        )

    try:
        emails = google_mail.list_recent_messages(token)
        return str(emails) if emails else "No emails found."
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        return f"Gmail API request failed ({status}): {exc}"
    except requests.RequestException as exc:
        return f"Gmail API request failed: {exc}"
