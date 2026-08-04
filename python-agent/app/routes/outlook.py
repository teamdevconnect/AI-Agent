from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from requests import HTTPError

from app.integrations import ms_graph
from app.memory import outlook_store
from app.security import get_current_user

router = APIRouter()


@router.get("/outlook/calendar-events")
def calendar_events(days: int = 7, user: dict = Depends(get_current_user)):
    """Plain data read for the product UI (Manager/Consultant dashboard's
    Team Calendar / Today's Meetings) — deliberately separate from
    calendar_tool.py's chat-tool action, which uses an unbounded $top=10
    list rather than a real date range. Returns connected: false (not an
    error) when the caller hasn't linked Outlook, so the dashboard can show
    a real "connect your calendar" prompt instead of an empty list that
    looks like "no meetings today"."""
    token = outlook_store.get_valid_access_token(user.get("sub", ""))
    if not token:
        return {"connected": False, "events": []}

    now = datetime.now(timezone.utc)
    data = ms_graph.graph_get(
        "/me/calendarview",
        token,
        params={
            "startDateTime": now.isoformat(),
            "endDateTime": (now + timedelta(days=days)).isoformat(),
            "$orderby": "start/dateTime",
            "$select": "subject,start,end",
            "$top": 50,
        },
    )
    events = [
        {
            "id": e.get("id", ""),
            "title": e.get("subject", ""),
            "start": e.get("start", {}).get("dateTime", ""),
            "end": e.get("end", {}).get("dateTime", ""),
        }
        for e in data.get("value", [])
    ]
    return {"connected": True, "events": events}


def _map_message(m: dict) -> dict:
    return {
        "id": m.get("id", ""),
        "subject": m.get("subject", ""),
        "from": (m.get("from") or {}).get("emailAddress", {}).get("address", ""),
        "to": [
            (r.get("emailAddress") or {}).get("address", "")
            for r in m.get("toRecipients") or []
        ],
        "receivedAt": m.get("receivedDateTime", ""),
        "preview": m.get("bodyPreview", ""),
        "isRead": m.get("isRead", True),
        "importance": m.get("importance", "normal"),
    }


@router.get("/outlook/todays-emails")
def todays_emails(user: dict = Depends(get_current_user)):
    """Powers the Deal Performance page's Customer Activity tab (Phase 11) —
    deliberately separate from outlook_tool.py's chat-tool "emails" action,
    which fetches an unbounded "most recent 10" with no date filter and no
    isRead/importance/toRecipients. This is the first caller anywhere in
    this codebase to use a real $filter date range plus isRead/importance
    on /me/messages. Same connected:false (not an error) convention as
    calendar_events above."""
    token = outlook_store.get_valid_access_token(user.get("sub", ""))
    if not token:
        return {"connected": False, "emails": []}

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    data = ms_graph.graph_get(
        "/me/messages",
        token,
        params={
            "$filter": f"receivedDateTime ge {today_start.isoformat()}",
            "$select": "id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,importance",
            "$orderby": "receivedDateTime desc",
            "$top": 100,
        },
    )
    return {"connected": True, "emails": [_map_message(m) for m in data.get("value", [])]}


@router.get("/outlook/messages-since")
def messages_since(since: str, user: dict = Depends(get_current_user)):
    """Parameterized sibling of todays_emails() for Phase 14b's scheduled
    Email Intelligence poller (backend/src/email-intelligence/
    email-intelligence-poller.service.ts) — NestJS computes the lookback
    window and passes `since` as a ready-to-use ISO8601 instant; this route
    just forwards it into Graph's $filter verbatim. Same connected:false
    (not an error) convention, same $select/shape as todays_emails."""
    token = outlook_store.get_valid_access_token(user.get("sub", ""))
    if not token:
        return {"connected": False, "emails": []}

    data = ms_graph.graph_get(
        "/me/messages",
        token,
        params={
            "$filter": f"receivedDateTime ge {since}",
            "$select": "id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,importance",
            "$orderby": "receivedDateTime desc",
            "$top": 100,
        },
    )
    return {"connected": True, "emails": [_map_message(m) for m in data.get("value", [])]}


class SendReplyRequest(BaseModel):
    messageId: str
    comment: str


@router.post("/outlook/send-reply")
def send_reply(payload: SendReplyRequest, user: dict = Depends(get_current_user)):
    """Phase 14d — dispatches a real reply to the original sender of
    `messageId` via Microsoft Graph (see ms_graph.reply_to_message). Called
    only from backend/src/email-intelligence/email-intelligence.service.ts's
    send(), itself only reachable after a human has explicitly approved AND
    then explicitly confirmed sending — this route has no independent
    safety gate of its own, it trusts the caller already enforced that."""
    token = outlook_store.get_valid_access_token(user.get("sub", ""))
    if not token:
        raise HTTPException(400, "Outlook is not connected for this user")

    try:
        ms_graph.reply_to_message(token, payload.messageId, payload.comment)
    except HTTPError as exc:
        # Surfaced honestly (e.g. insufficient scope on a not-yet-reconnected
        # account, or a message id that no longer exists) — never silently
        # treated as success.
        status = exc.response.status_code if exc.response is not None else 502
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status, f"Failed to send reply via Outlook: {detail}") from exc

    return {"sent": True}
