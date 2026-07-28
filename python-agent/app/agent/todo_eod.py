"""Dedicated To-Do and EOD generation — gathers explicitly and separately
from CRM, Outlook, Calendar, and internal documents/notes (via the same
specialists app.agent.orchestrator uses for live chat delegation, see
app.agent.specialists), rather than the single blended search
app.agent.crew_reports's scheduled crew uses. Every source is checked every
time — deterministic coverage, not left to a classifier's judgment about
whether a source seems relevant, which matters for a report that's supposed
to be comprehensive.

Deliberately does NOT replace app.agent.crew_reports or touch
/reports/generate (the NestJS-scheduled production path store-settings.
service.ts's cron already calls) — this is a new, additive, richer
alternative exposed through the workflow engine (app.workflows.definitions),
not a migration of the existing, separately-stable system.
"""

from concurrent.futures import ThreadPoolExecutor

from app.agent import anthropic_client
from app.agent.graph import final_text, get_graph
from app.agent.specialists import SPECIALISTS

_TODO_SOURCES = {
    "crm": "Check the CRM for new enquiries, deals needing follow-up, stalled deals, and quotes awaiting a response.",
    "outlook": "Check Outlook for unread or important emails needing a reply or action today.",
    "calendar": "Check the calendar for today's meetings and any scheduling conflicts or prep needed.",
    "knowledge": "Check saved notes/preferences and any shared documents (SOPs/policies) relevant to today's priorities.",
}

_EOD_SOURCES = {
    "crm": "Check the CRM for what changed today: notes added, deals moved forward, quotes sent or accepted.",
    "outlook": "Check Outlook for emails sent or received today that reflect completed or pending work.",
    "calendar": "Check the calendar for meetings that happened today and any follow-ups they generated.",
    "knowledge": "Check saved notes/preferences and any documents updated today.",
}

TODO_SYSTEM_PROMPT = """You are the To-Do Agent, producing today's prioritized task list from research \
already gathered separately across CRM, Outlook, Calendar, and internal documents/notes (each section \
below is labeled by source). For each task, infer and weave in naturally: priority (urgent/high/medium/low), \
a deadline if one is evident (else "today"), estimated effort (quick win under 30 min / short task under \
2 hours / long task), business impact in one phrase (revenue, client relationship, compliance, internal), \
and dependencies (what needs to happen first, if anything). End with a suggested order to work through \
the day. Write as clear prose grouped by priority, not a rigid table — but every task should carry these \
details, not just a title."""

EOD_SYSTEM_PROMPT = """You are the EOD Agent, producing an end-of-day report from research already \
gathered separately across CRM, Outlook, Calendar, and internal documents/notes (each section below is \
labeled by source). Structure your report with these exact sections: Completed Today, Missed/Overdue, \
Pending Actions, AI Observations (patterns or risks worth flagging that a quick glance wouldn't catch), \
Tomorrow's Priorities, and a short Manager Summary (2-3 sentences — the headline version for someone who \
only reads one part)."""


def _gather(sources: dict[str, str], user_id: str, label: str) -> dict[str, str]:
    def run_one(agent_key: str, task: str) -> tuple[str, str]:
        spec = SPECIALISTS[agent_key]
        result = get_graph().invoke(
            {
                "messages": [{"role": "user", "content": task}],
                "pending_calls": [],
                "tools_used": [],
                "rounds": 0,
                "provider": "",
                "user_id": user_id,
                "conversation_id": f"{label}-{agent_key}",
                "on_event": None,
                "system_prompt": spec["system_prompt"],
                "allowed_tools": spec["tools"],
            }
        )
        return agent_key, final_text(result)

    with ThreadPoolExecutor(max_workers=len(sources)) as executor:
        results = list(executor.map(lambda kv: run_one(*kv), sources.items()))
    return dict(results)


def _synthesize(findings: dict[str, str], system_prompt: str, instruction: str) -> str:
    findings_text = "\n\n".join(f"[{source}]\n{text}" for source, text in findings.items())
    output_items = anthropic_client.call(
        [{"role": "user", "content": f"Research gathered:\n\n{findings_text}\n\n{instruction}"}],
        system_prompt=system_prompt,
        tools=[],
    )
    return final_text({"messages": output_items})


def generate_todo(user_id: str) -> str:
    findings = _gather(_TODO_SOURCES, user_id, "todo-agent")
    return _synthesize(findings, TODO_SYSTEM_PROMPT, "Generate today's prioritized to-do list.")


def generate_eod(user_id: str) -> str:
    findings = _gather(_EOD_SOURCES, user_id, "eod-agent")
    return _synthesize(findings, EOD_SYSTEM_PROMPT, "Generate the end-of-day report.")
