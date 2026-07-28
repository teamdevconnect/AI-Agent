"""Autonomous task execution — drives the full Planner/specialist/reflection
stack (app.agent.orchestrator) from a goal string with no live user turn
behind it, for scheduled jobs or future proactive triggers (app.agent.
crew_reports's scheduled report is a separate, already-working system and is
NOT rewired to this — this is a foundation for work that hasn't been built
yet, e.g. a future workflow engine, not a replacement for what already runs).

Reuses the exact same stack live chat uses, not a separate framework — see
app.agent.specialists's module docstring for why that matters here too:
crewai's tool-calling executor doesn't work with the configured Anthropic
model.
"""

from app.agent.graph import final_text
from app.agent.orchestrator import run as run_agent

# No real user's session backs an autonomous run — user_id="*" matches how
# shared, no-owner business data is already tagged (see app.rag.business_sync).
_AUTONOMOUS_USER_ID = "*"


def run_autonomous_task(goal: str, user_id: str = _AUTONOMOUS_USER_ID, conversation_id: str = "autonomous") -> dict:
    """Runs one goal through Planner -> (specialists) -> reflection and
    returns {"reply": str, "tools_used": list[str]}. conversation_id has no
    backing Mongo conversation document (autonomous runs aren't chat turns),
    so it's a label for logging/tracing only — nothing reads it back."""
    result = run_agent(
        {
            "messages": [{"role": "user", "content": goal}],
            "pending_calls": [],
            "tools_used": [],
            "rounds": 0,
            "provider": "",
            "user_id": user_id,
            "conversation_id": conversation_id,
            "system_prompt": None,
        }
    )
    return {"reply": final_text(result), "tools_used": result.get("tools_used", [])}
