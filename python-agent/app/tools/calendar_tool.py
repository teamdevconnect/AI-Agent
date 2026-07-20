from datetime import datetime, timedelta

import requests

from app.config import settings
from app.integrations import ms_graph
from app.memory import outlook_store

SPEC = {
    "name": "calendar_tool",
    "description": "List the signed-in user's upcoming calendar events or schedule a new meeting via Outlook Calendar.",
    "input_schema": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["list_events", "schedule_meeting"]},
            "title": {"type": "string", "description": "Meeting title (schedule_meeting only)."},
            "start_time": {
                "type": "string",
                "description": "ISO 8601 start time (schedule_meeting only).",
            },
            "attendees": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Attendee email addresses (schedule_meeting only).",
            },
        },
        "required": ["action"],
    },
}


def run(tool_input: dict, context: dict) -> str:
    action = tool_input.get("action", "list_events")

    if not settings.ms_graph_client_id:
        if action == "list_events":
            return str([{"id": "evt-1", "title": "Weekly sync", "start": "2026-07-16T10:00:00Z"}])
        return (
            f"Stub: would schedule '{tool_input.get('title', 'Untitled meeting')}' "
            f"at {tool_input.get('start_time', 'unspecified time')}."
        )

    token = outlook_store.get_valid_access_token(context.get("user_id", ""))
    if not token:
        return (
            "This user hasn't connected Outlook yet. Ask them to click "
            "'Connect Outlook' in the app to authorize access to their calendar."
        )

    try:
        if action == "list_events":
            data = ms_graph.graph_get(
                "/me/events",
                token,
                params={
                    "$top": 10,
                    "$orderby": "start/dateTime",
                    "$select": "subject,start,end,organizer",
                },
            )
            events = [
                {
                    "title": e.get("subject", ""),
                    "start": e.get("start", {}).get("dateTime", ""),
                    "end": e.get("end", {}).get("dateTime", ""),
                }
                for e in data.get("value", [])
            ]
            return str(events) if events else "No upcoming events found."

        start_time = tool_input.get("start_time")
        if not start_time:
            return "Cannot schedule a meeting without a start_time."
        start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end_dt = start_dt + timedelta(minutes=30)

        event_body = {
            "subject": tool_input.get("title", "Untitled meeting"),
            "start": {"dateTime": start_dt.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": "UTC"},
            "attendees": [
                {"emailAddress": {"address": a}, "type": "required"}
                for a in tool_input.get("attendees", [])
            ],
        }
        ms_graph.graph_post("/me/events", token, event_body)
        return f"Scheduled '{event_body['subject']}' at {start_dt.isoformat()}."
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        return f"Microsoft Graph request failed ({status}): {exc}"
    except requests.RequestException as exc:
        return f"Microsoft Graph request failed: {exc}"
