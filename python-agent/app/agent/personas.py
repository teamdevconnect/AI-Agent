from dataclasses import dataclass

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


@dataclass
class Persona:
    system_prompt: str | None
    allowed_tools: list[str] | None
    model_tier: str | None


def resolve_persona(agent_id: str | None, organization_id: str | None = None) -> Persona:
    """Replaces the old resolve_system_prompt(agent_id) -> str | None (only
    2 call sites, both in app.routes.chat, both updated alongside this).
    Built-ins are fully unrestricted/untiered, same as before this existed.
    Custom roles (backend/src/agent-roles) are read directly from Mongo
    (read-only), same convention as conversation_store.py — now scoped by
    organizationId,
    fixing a real cross-tenant gap: two orgs can share a slug (the unique
    index is {organizationId, slug}, not global), so a bare
    {slug, status:'active'} lookup could previously resolve the wrong org's
    system prompt/persona."""
    if not agent_id:
        return Persona(system_prompt=None, allowed_tools=None, model_tier=None)
    if agent_id in PERSONAS:
        return Persona(system_prompt=PERSONAS[agent_id], allowed_tools=None, model_tier=None)

    try:
        query = {"slug": agent_id, "status": "active"}
        if organization_id:
            query["organizationId"] = organization_id
        doc = get_db().agent_roles.find_one(query)
    except Exception:
        return Persona(system_prompt=None, allowed_tools=None, model_tier=None)

    if not doc:
        return Persona(system_prompt=None, allowed_tools=None, model_tier=None)

    # allowedTools defaults to [] in the schema, not absent — an empty list
    # here must mean "unrestricted" (None), matching
    # get_tool_definitions(allowed_tools) if allowed_tools else None's own
    # falsy check in app.agent.graph.planner_node, not "no tools at all".
    allowed_tools = doc.get("allowedTools") or None
    return Persona(
        system_prompt=doc.get("systemPrompt"),
        allowed_tools=allowed_tools,
        model_tier=doc.get("modelTier"),
    )
