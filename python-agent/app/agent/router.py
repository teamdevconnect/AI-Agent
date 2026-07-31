def choose_provider(state: dict) -> str:
    """Provider selection is intentionally Anthropic-only here. This is the
    entry point for the main planner/tool-calling graph (app.agent.graph),
    where any turn might request a tool call, and app.agent.groq_client's
    integration has no tool-calling support at all (its call() takes no
    `tools` parameter). Routing a tool-capable turn to Groq here would
    silently break tool use mid-conversation. Groq is only ever used via
    app.agent.orchestrator's separate, already-safe 'general' classification
    bypass — a turn pre-classified as needing no tools/business data skips
    this graph (and this function) entirely, calling groq_client.call()
    directly. See choose_model below for the real per-turn routing lever
    available at this call site.
    """
    return "anthropic"


def choose_model(state: dict) -> str:
    """Real cost/speed-based routing: which Anthropic model tier, not which
    provider (see choose_provider's docstring for why provider stays fixed
    here). settings.anthropic_routing_model is meant to be a cheaper/faster
    tier (e.g. Haiku-class) — both tiers are fully tool-capable, so tier
    selection is safe for any turn this graph might see, unlike a provider
    switch would be.

    A persona (see app.agent.personas, Phase 6) can pin an explicit tier via
    state["model_tier"] — takes priority over the heuristic below when set,
    since that's a deliberate admin choice for that specific AI role, not a
    guess. Unset (every persona created before this existed, and both
    built-ins) falls through unchanged to the original heuristic: a short
    message on the first round of a fresh turn (no prior tool rounds yet) is
    more likely answerable without much reasoning depth; anything longer, or
    already mid a multi-round tool loop, uses the main model. Deliberately
    simple (message length + round count, not real complexity analysis) — an
    MVP heuristic to make this a real decision instead of a hardcoded model,
    not a tuned classifier.
    """
    from app.config import settings

    model_tier = state.get("model_tier")
    if model_tier == "fast":
        return settings.anthropic_routing_model
    if model_tier == "standard":
        return settings.anthropic_model

    if state.get("rounds", 0) > 0:
        return settings.anthropic_model

    messages = state.get("messages") or []
    recent_length = sum(len(str(m.get("content", ""))) for m in messages[-3:])
    if recent_length < 400 and not state.get("allowed_tools"):
        return settings.anthropic_routing_model
    return settings.anthropic_model
