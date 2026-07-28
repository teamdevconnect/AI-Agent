"""Approximate USD cost from Anthropic token usage. Pricing is
env-overridable since list prices change over time and vary by exact model
— treat these figures as estimates for relative cost tracking, not
billing-accurate numbers.
"""

import os

_DEFAULT_INPUT_PER_MTOK = 3.0  # USD per 1M input tokens, Claude Sonnet-class default
_DEFAULT_OUTPUT_PER_MTOK = 15.0  # USD per 1M output tokens, Claude Sonnet-class default

_INPUT_PER_MTOK = float(os.environ.get("ANTHROPIC_INPUT_COST_PER_MTOK", _DEFAULT_INPUT_PER_MTOK))
_OUTPUT_PER_MTOK = float(os.environ.get("ANTHROPIC_OUTPUT_COST_PER_MTOK", _DEFAULT_OUTPUT_PER_MTOK))


def estimate_cost(input_tokens: int, output_tokens: int) -> float:
    return (input_tokens / 1_000_000) * _INPUT_PER_MTOK + (output_tokens / 1_000_000) * _OUTPUT_PER_MTOK
