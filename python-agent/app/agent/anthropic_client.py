import json
from functools import lru_cache

import anthropic

from app.config import settings
from app.memory import integration_store
from app.tools.registry import TOOL_DEFINITIONS

from app.agent.llm_client import SYSTEM_PROMPT


@lru_cache
def _client(api_key: str) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=api_key)


def _resolve_api_key() -> str:
    # A key saved via the frontend's Integrations page (Mongo-backed, can
    # change at runtime without restarting this process) takes precedence
    # over the static .env value.
    return integration_store.get_api_key("anthropic") or settings.anthropic_api_key


def _turn_role(item: dict) -> str:
    item_type = item.get("type")
    if item_type == "function_call":
        return "assistant"
    if item_type == "function_call_output":
        return "user"
    return "assistant" if item.get("role") == "assistant" else "user"


def _item_to_blocks(item: dict) -> list[dict]:
    item_type = item.get("type")
    if item_type == "function_call":
        return [
            {
                "type": "tool_use",
                "id": item["call_id"],
                "name": item["name"],
                "input": json.loads(item.get("arguments") or "{}"),
            }
        ]
    if item_type == "function_call_output":
        return [
            {
                "type": "tool_result",
                "tool_use_id": item["call_id"],
                "content": str(item.get("output", "")),
            }
        ]

    content = item.get("content")
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    if isinstance(content, list):
        blocks = [
            {"type": "text", "text": c.get("text", "")}
            for c in content
            if isinstance(c, dict) and c.get("type") in ("output_text", "input_text", "text")
        ]
        return blocks or [{"type": "text", "text": ""}]
    return [{"type": "text", "text": ""}]


def _to_anthropic_messages(input_items: list[dict]) -> list[dict]:
    """Groups the OpenAI-Responses-shaped flat item list into Anthropic's

    strict alternating-turn shape, merging consecutive same-role items into
    one message (Anthropic requires every tool_use block from one assistant
    turn, and every matching tool_result, to each live in a single message).
    """
    messages: list[dict] = []
    for item in input_items:
        role = _turn_role(item)
        blocks = _item_to_blocks(item)
        if messages and messages[-1]["role"] == role:
            messages[-1]["content"].extend(blocks)
        else:
            messages.append({"role": role, "content": blocks})
    return messages


def _normalize_response(response: anthropic.types.Message) -> list[dict]:
    items: list[dict] = []
    text_parts: list[str] = []
    for block in response.content:
        if block.type == "tool_use":
            items.append(
                {
                    "type": "function_call",
                    "call_id": block.id,
                    "name": block.name,
                    "arguments": json.dumps(block.input or {}),
                }
            )
        elif block.type == "text":
            text_parts.append(block.text)

    if text_parts:
        items.append(
            {
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": "\n".join(text_parts)}],
            }
        )
    return items


def call(input_items: list[dict]) -> list[dict]:
    api_key = _resolve_api_key()
    if not api_key:
        raise RuntimeError("No Anthropic API key configured")

    response = _client(api_key).messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=TOOL_DEFINITIONS,
        messages=_to_anthropic_messages(input_items),
    )
    return _normalize_response(response)
