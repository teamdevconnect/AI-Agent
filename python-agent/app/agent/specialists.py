"""Domain-scoped sub-agent definitions for app.agent.orchestrator.

Each specialist is a restricted instance of the same planner/tools loop
(app.agent.graph) — not a separate agent framework — scoped via
allowed_tools (app.agent.state) to the subset of app.tools.registry tools
relevant to its domain. See app.agent.crew_reports's module docstring for
why these are NOT built with crewai: the configured Anthropic model rejects
assistant-message prefill, which crewai's default tool-calling executor
depends on, while graph.py's loop drives Claude's native tool-use API
directly and never hits that restriction.

Tool scopes are a strict partition of the domain tools in app.tools.registry
— every domain tool belongs to exactly one specialist, so delegating never
loses capability relative to the single-loop path. "remember" (long-term
memory, app.tools.memory_tool) is the one deliberate exception: it's
cross-cutting rather than domain-specific, so every specialist gets it —
any of them might learn something durable worth saving mid-task.
"""

from app.prompts.registry import render

_SHARED_TOOLS = ["remember"]


def _tools(*domain_tools: str) -> list[str]:
    return [*domain_tools, *_SHARED_TOOLS]


SPECIALISTS = {
    "crm": {
        "label": "CRM",
        "tools": _tools("crm_contact", "crm_deal", "crm_note", "crm_tag", "crm_account", "crm_product", "crm_quote"),
        "system_prompt": render("specialist_crm", base=render("base_system")),
    },
    "outlook": {
        "label": "Outlook",
        "tools": _tools("outlook_lookup", "send_email"),
        "system_prompt": render("specialist_outlook", base=render("base_system")),
    },
    "calendar": {
        "label": "Calendar",
        "tools": _tools("calendar_tool"),
        "system_prompt": render("specialist_calendar", base=render("base_system")),
    },
    "knowledge": {
        "label": "Knowledge",
        "tools": _tools("search_business_context", "search_documents", "web_search"),
        "system_prompt": render("specialist_knowledge", base=render("base_system")),
    },
    "operations": {
        "label": "Store Operations",
        "tools": _tools("query_database", "employee_lookup", "send_whatsapp_message"),
        "system_prompt": render("specialist_operations", base=render("base_system")),
    },
}
