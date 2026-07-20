import requests

from app.config import settings
from app.integrations import ms_graph
from app.memory import outlook_store

SPEC = {
    "name": "outlook_lookup",
    "description": "Read the signed-in user's Outlook mailbox or contacts via Microsoft Graph.",
    "input_schema": {
        "type": "object",
        "properties": {
            "resource": {
                "type": "string",
                "enum": ["emails", "contacts"],
                "description": "Which Outlook resource to fetch.",
            },
        },
        "required": ["resource"],
    },
}


def run(tool_input: dict, context: dict) -> str:
    resource = tool_input.get("resource", "emails")

    if not settings.ms_graph_client_id:
        placeholder = {
            "emails": [
                {
                    "id": "msg-1",
                    "from": "client@example.com",
                    "subject": "Following up on our proposal",
                }
            ],
            "contacts": [],
        }
        return str(placeholder.get(resource, []))

    token = outlook_store.get_valid_access_token(context.get("user_id", ""))
    if not token:
        return (
            "This user hasn't connected Outlook yet. Ask them to click "
            "'Connect Outlook' in the app to authorize access to their mailbox."
        )

    try:
        if resource == "emails":
            data = ms_graph.graph_get(
                "/me/messages",
                token,
                params={
                    "$top": 10,
                    "$orderby": "receivedDateTime desc",
                    "$select": "subject,from,receivedDateTime,bodyPreview",
                },
            )
            emails = [
                {
                    "from": m.get("from", {}).get("emailAddress", {}).get("address", ""),
                    "subject": m.get("subject", ""),
                    "received": m.get("receivedDateTime", ""),
                    "preview": m.get("bodyPreview", ""),
                }
                for m in data.get("value", [])
            ]
            return str(emails) if emails else "No emails found."

        data = ms_graph.graph_get(
            "/me/contacts", token, params={"$top": 10, "$select": "displayName,emailAddresses"}
        )
        contacts = [
            {
                "name": c.get("displayName", ""),
                "email": (c.get("emailAddresses") or [{}])[0].get("address", ""),
            }
            for c in data.get("value", [])
        ]
        return str(contacts) if contacts else "No contacts found."
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        return f"Microsoft Graph request failed ({status}): {exc}"
    except requests.RequestException as exc:
        return f"Microsoft Graph request failed: {exc}"
