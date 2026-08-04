"""Approximate USD cost from token usage. Pricing is env-overridable since
list prices change over time and vary by exact model — treat these figures
as estimates for relative cost tracking, not billing-accurate numbers.

Provider-aware: applying Anthropic's per-token rate to Groq tokens (or vice
versa) would silently produce a *wrong* number, not just a missing one, so
an unconfigured/unknown provider returns None (shown as "—" in the UI)
rather than a fabricated estimate.
"""

import os

_RATES_PER_MTOK: dict[str, tuple[float, float]] = {
    # (input $/MTok, output $/MTok). Claude Sonnet-class default.
    "anthropic": (
        float(os.environ.get("ANTHROPIC_INPUT_COST_PER_MTOK", 3.0)),
        float(os.environ.get("ANTHROPIC_OUTPUT_COST_PER_MTOK", 15.0)),
    ),
    # Groq's Llama-3.3-70B list pricing as of this app's default groq_model
    # (see app.config.settings.groq_model) — override if a different model
    # is configured, since Groq's per-model rates vary more than Anthropic's.
    "groq": (
        float(os.environ.get("GROQ_INPUT_COST_PER_MTOK", 0.59)),
        float(os.environ.get("GROQ_OUTPUT_COST_PER_MTOK", 0.79)),
    ),
}


def estimate_cost(input_tokens: int, output_tokens: int, provider: str = "anthropic") -> float | None:
    rates = _RATES_PER_MTOK.get(provider)
    if rates is None:
        return None
    input_rate, output_rate = rates
    return (input_tokens / 1_000_000) * input_rate + (output_tokens / 1_000_000) * output_rate
