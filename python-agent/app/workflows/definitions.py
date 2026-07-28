"""Concrete workflow definitions, registered onto app.workflows.engine at
import time (triggered by app.main importing app.workflows). Each wraps
existing capability rather than reimplementing it: morning_brief/eod_report
reuse the existing scheduled-report crew (app.agent.crew_reports) verbatim,
todo_agent/eod_agent are built on app.agent.todo_eod's explicit
CRM/Outlook/Calendar/Documents gathering (a richer alternative to
morning_brief/eod_report — see that module's docstring for why it's
additive, not a replacement), and the rest are built on
app.agent.autonomous's goal runner (the same Planner/specialist/reflection
stack live chat uses).
"""

from app.agent.anthropic_client import extract_report_structure
from app.agent.autonomous import run_autonomous_task
from app.agent.crew_reports import run_report_crew
from app.agent.todo_eod import generate_eod, generate_todo
from app.events import bus
from app.notifications.client import notify
from app.workflows.engine import Workflow, register, run_workflow

_NOTIFICATION_PREVIEW_CHARS = 280


def _preview(text: str) -> str:
    text = text.strip()
    return text if len(text) <= _NOTIFICATION_PREVIEW_CHARS else text[:_NOTIFICATION_PREVIEW_CHARS].rsplit(" ", 1)[0] + "..."


def _run_report(report_type: str) -> dict:
    reply = run_report_crew(report_type)
    structured = extract_report_structure(reply, report_type)
    return {"reply": reply, **structured}


register(
    Workflow(
        name="morning_brief",
        description="Prioritized to-do list for the day, from CRM/Outlook research (reuses app.agent.crew_reports).",
        run=lambda context: _run_report("morning"),
    )
)

register(
    Workflow(
        name="eod_report",
        description="End-of-day summary of completed/outstanding work (reuses app.agent.crew_reports).",
        run=lambda context: _run_report("eod"),
    )
)


def _todo_agent(context: dict) -> dict:
    user_id = context.get("user_id") or "*"
    reply = generate_todo(user_id)
    structured = extract_report_structure(reply, "morning")
    notify(
        user_id,
        title="Today's priorities are ready",
        description=_preview(reply),
        kind="system",
        source="workflow:todo_agent",
    )
    return {"reply": reply, **structured}


register(
    Workflow(
        name="todo_agent",
        description=(
            "Prioritized to-do list with deadline/effort/impact/dependencies per task, from explicit "
            "CRM + Outlook + Calendar + Documents gathering (built on app.agent.todo_eod — richer than "
            "morning_brief, which uses one blended search)."
        ),
        run=_todo_agent,
    )
)


def _eod_agent(context: dict) -> dict:
    user_id = context.get("user_id") or "*"
    reply = generate_eod(user_id)
    structured = extract_report_structure(reply, "eod")
    notify(
        user_id,
        title="End-of-day report is ready",
        description=_preview(reply),
        kind="system",
        source="workflow:eod_agent",
    )
    return {"reply": reply, **structured}


register(
    Workflow(
        name="eod_agent",
        description=(
            "Completed/missed/pending/observations/tomorrow's-priorities/manager-summary report, from "
            "explicit CRM + Outlook + Calendar + Documents gathering (built on app.agent.todo_eod — "
            "richer than eod_report, which uses one blended search)."
        ),
        run=_eod_agent,
    )
)


def _crm_follow_up_check(context: dict) -> dict:
    result = run_autonomous_task(
        "Search the CRM for contacts or deals that haven't had a follow-up note or activity "
        "in a while, and any deals with an approaching or passed closing date but no recent "
        "movement. List the specific ones that need attention and why."
    )
    # Proactive AI: surfaces this without anyone asking, rather than only
    # answering when a user happens to think to check.
    notify(
        context.get("user_id", ""),
        title="CRM follow-up check",
        description=_preview(result["reply"]),
        kind="warning",
        source="workflow:crm_follow_up_check",
    )
    return result


register(
    Workflow(
        name="crm_follow_up_check",
        description="Scans CRM for contacts/deals needing follow-up (built on app.agent.autonomous).",
        run=_crm_follow_up_check,
    )
)


def _summarize_document(context: dict) -> dict:
    filename = context.get("filename", "the document")
    document_id = context.get("document_id", "")
    # Documents are indexed per-uploader (app.rag.retriever's user_id filter
    # requires an exact match, unlike CRM's shared user_id="*") — running
    # this as the autonomous runner's default "*" user would silently see no
    # results, since it isn't the same identity the document was indexed
    # under. Falls back to "*" only if the event payload is ever missing it.
    user_id = context.get("user_id") or "*"
    result = run_autonomous_task(
        f"A document called '{filename}' (id {document_id}) was just uploaded. Use "
        f"search_documents to read its content, write a concise summary of its key points, "
        f"and save that summary as a long-term memory so it's available in future conversations.",
        user_id=user_id,
    )
    notify(
        user_id,
        title=f"Document summarized: {filename}",
        description=_preview(result["reply"]),
        kind="system",
        source="workflow:summarize_document",
    )
    return result


register(
    Workflow(
        name="summarize_document",
        description="Summarizes a newly uploaded document and saves the summary as long-term memory (built on app.agent.autonomous).",
        run=_summarize_document,
    )
)


@bus.on("document.uploaded")
def _on_document_uploaded(payload: dict) -> None:
    run_workflow("summarize_document", payload)
