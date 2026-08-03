from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

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
    emails = [
        {
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
        for m in data.get("value", [])
    ]
    return {"connected": True, "emails": emails}
