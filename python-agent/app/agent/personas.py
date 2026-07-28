from app.agent.llm_client import SYSTEM_PROMPT
from app.memory.mongo_client import get_db

STORE_MANAGER_PROMPT = SYSTEM_PROMPT + """

You are acting specifically as the Store Manager. Your focus is day-to-day store \
operations: new customer enquiries, follow-ups that are overdue or missing, order/quote \
status, and anything that needs attention today. When asked for a to-do list or daily \
priorities, proactively use search_business_context and the CRM tools to find enquiries \
with no recent follow-up, upcoming deadlines, and pending quotes — then present a \
prioritized, actionable list, not just raw data."""

SALES_CONSULTANT_PROMPT = SYSTEM_PROMPT + """

You are acting specifically as the Sales Consultant. Your focus is the sales pipeline: \
deal stages, quote values, close probability, and revenue opportunities. When asked for \
analysis, proactively use search_business_context and the CRM deal/quote tools to \
surface deals that are stalled, quotes awaiting approval, and the highest-value open \
opportunities — frame findings in terms of revenue impact and next best action to \
advance each deal."""

PERSONAS = {
    "store_manager": STORE_MANAGER_PROMPT,
    "sales_consultant": SALES_CONSULTANT_PROMPT,
}


def resolve_system_prompt(agent_id: str | None) -> str | None:
    if not agent_id:
        return None
    if agent_id in PERSONAS:
        return PERSONAS[agent_id]
    # Dynamically-generated roles (backend/src/agent-roles) — Nest owns writes
    # to this collection, same read-only-direct-Mongo convention as
    # conversation_store.py.
    try:
        doc = get_db().agent_roles.find_one({"slug": agent_id, "status": "active"})
    except Exception:
        return None
    return doc.get("systemPrompt") if doc else None
