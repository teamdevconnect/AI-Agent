import operator
import threading
from typing import Annotated, Callable, TypedDict


class AgentState(TypedDict):
    messages: Annotated[list[dict], operator.add]
    pending_calls: list[dict]
    tools_used: Annotated[list[str], operator.add]
    rounds: int
    provider: str
    user_id: str
    # The caller's tenant (multi-tenant Phase 1/2) — None for callers built
    # before this field existed (e.g. crew_reports.py's scheduled-report
    # context), which fall back to env-configured global CRM credentials
    # rather than per-org resolution. See app.integrations.prospectconnect.
    organization_id: str | None
    conversation_id: str
    # Not serialized/checkpointed (no checkpointer is used) — a plain
    # in-process callback for streaming text/tool-progress events out of
    # planner_node as they happen. None for non-streaming callers.
    on_event: Callable[[dict], None] | None
    # Resolved persona prompt (see app.agent.personas) — None uses the
    # default SYSTEM_PROMPT.
    system_prompt: str | None
    # Restricts which tools the planner may call this turn, by tool name.
    # None (or missing, for callers built before this field existed) means
    # the full registry. Set by app.agent.orchestrator to scope a specialist
    # sub-agent (see app.agent.specialists) to its domain's tools only.
    allowed_tools: list[str] | None
    # Persona-level model tier override (see app.agent.personas, Phase 6) —
    # None (or missing) falls through to app.agent.router.choose_model's
    # existing message-length/round-based heuristic, unchanged.
    model_tier: str | None
    # Set (see app.agent.cancellation) for the lifetime of one /chat/stream
    # request — checked inside the streaming loop (app.agent.anthropic_client.call)
    # and between planner rounds (should_continue below) so a user clicking
    # "stop" actually halts further generation, not just the UI. None for
    # non-streaming callers and anything that never registered cancellation.
    cancel_event: threading.Event | None
