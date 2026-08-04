"""Persists what app.observability.tracing's context managers already
compute (latency/tokens/cost/success) to Mongo — the OTel spans alone are
console-only in this dev environment (see tracing.py's docstring) and were
never queryable by the NestJS backend's Command Center API.

Field names are deliberately camelCase, not Python's native snake_case —
every other collection in this shared "agent" database (Conversation,
DailyReport, TimelineEvent, ...) uses camelCase, and NestJS reads this
collection directly (read-only from its side; this module is the only
writer), so matching that convention keeps the database internally
consistent instead of introducing the one snake_case collection in it.
"""

from datetime import datetime, timezone

from app.memory.mongo_client import get_db


def record_llm_execution(
    *,
    organization_id: str | None,
    user_id: str,
    conversation_id: str,
    name: str,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float | None,
    latency_ms: float,
    success: bool,
    error: str | None,
) -> None:
    get_db().agent_executions.insert_one(
        {
            "organizationId": organization_id,
            "userId": user_id,
            "conversationId": conversation_id,
            "kind": "llm",
            "name": name,
            "provider": provider,
            "model": model,
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "costUsd": cost_usd,
            "latencyMs": latency_ms,
            "success": success,
            "error": error,
            "occurredAt": datetime.now(timezone.utc),
        }
    )


def record_tool_execution(
    *,
    organization_id: str | None,
    user_id: str,
    conversation_id: str,
    name: str,
    latency_ms: float,
    success: bool,
) -> None:
    get_db().agent_executions.insert_one(
        {
            "organizationId": organization_id,
            "userId": user_id,
            "conversationId": conversation_id,
            "kind": "tool",
            "name": name,
            "latencyMs": latency_ms,
            "success": success,
            "occurredAt": datetime.now(timezone.utc),
        }
    )
