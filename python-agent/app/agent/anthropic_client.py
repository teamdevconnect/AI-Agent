import base64
import json
import time
from functools import lru_cache
from typing import Callable

import anthropic

from app.config import settings
from app.memory import integration_store
from app.observability.tracing import traced_llm_call
from app.tools.registry import TOOL_DEFINITIONS

from app.agent.llm_client import SYSTEM_PROMPT
from app.agent.specialists import SPECIALISTS

# Anthropic error shapes worth a short backoff-retry — all transient/load-related,
# never a genuine request problem (bad schema, invalid content, auth) that a retry
# would just reproduce identically.
_RETRYABLE_ERROR_TYPES = {"overloaded_error", "rate_limit_error", "api_error"}
_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 529}
_MAX_CALL_ATTEMPTS = 3


def _is_retryable(exc: Exception) -> bool:
    if not isinstance(exc, anthropic.APIStatusError):
        return False
    if exc.status_code in _RETRYABLE_STATUS_CODES:
        return True
    body = exc.body if isinstance(exc.body, dict) else {}
    return (body.get("error") or {}).get("type") in _RETRYABLE_ERROR_TYPES


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


def _cache_last_tool(tools_list: list[dict]) -> list[dict]:
    """Marks the last tool definition as an Anthropic prompt-cache breakpoint.
    The system prompt + full tool registry are identical on almost every
    call (same persona, same static registry) across a multi-round tool
    loop and across concurrent specialist fan-out — caching them cuts
    latency/cost on every round after the first. Returns a new list; never
    mutates the shared TOOL_DEFINITIONS/specialist tool-list constants.
    """
    if not tools_list:
        return tools_list
    return [*tools_list[:-1], {**tools_list[-1], "cache_control": {"type": "ephemeral"}}]


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
    """Commentary text alongside tool_use in a round that still has pending
    tool calls is deliberately dropped, not just reordered after the
    tool_use blocks (which is what this used to do). Two real bugs, found
    live: (1) a bare Anthropic API call reproduced this exact shape — a
    round with tool_use-only (no text) followed by a later round with
    tool_use+text — and Anthropic rejected the conversation on the *next*
    call with "This model does not support assistant message prefill",
    even though the message list correctly ended in a user turn; the text
    is never shown to the user for a non-final round anyway (final_text()
    only ever reads the last pure-text assistant message), so the safe fix
    is to not carry it into history at all when tool_use is also present.
    (2) separately, a text-only round can legitimately produce an empty
    string (e.g. a cancelled/degenerate turn), and Anthropic rejects empty
    text content blocks outright — guarded by only emitting non-empty text.
    """
    items: list[dict] = []
    text_parts: list[str] = []
    has_tool_use = False
    for block in response.content:
        if block.type == "tool_use":
            has_tool_use = True
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

    joined_text = "\n".join(text_parts)
    if joined_text and not has_tool_use:
        items.append(
            {
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": joined_text}],
            }
        )
    return items


ROLE_EXTRACTION_TOOL = {
    "name": "extract_role_definition",
    "description": "Return a structured role definition extracted from the supplied business document.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "department": {"type": "string"},
            "description": {"type": "string"},
            "responsibilities": {"type": "array", "items": {"type": "string"}},
            "dailyTasks": {"type": "array", "items": {"type": "string"}},
            "weeklyTasks": {"type": "array", "items": {"type": "string"}},
            "kpis": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"name": {"type": "string"}, "description": {"type": "string"}},
                    "required": ["name", "description"],
                },
            },
            "systemPrompt": {"type": "string"},
        },
        "required": [
            "name",
            "department",
            "description",
            "responsibilities",
            "dailyTasks",
            "weeklyTasks",
            "kpis",
            "systemPrompt",
        ],
    },
}

ROLE_EXTRACTION_SYSTEM_PROMPT = """You are extracting a structured AI persona definition from a \
business document (job description, SOP, or KPI sheet). Infer reasonable values for anything the \
document doesn't state explicitly — never leave a field empty, never ask for clarification.

The "systemPrompt" field must match this house style exactly (it is appended to a shared base \
prompt, same as two existing hand-written personas):
"You are acting specifically as the {name}. Your focus is ... . When asked about X, proactively \
use search_business_context and [name the 2-3 most relevant tools: CRM deal/quote tools, \
search_documents, etc.] to ... — [describe the framing/output style expected]."
Second person, present tense, names concrete tools, 3-5 sentences. Always call \
extract_role_definition exactly once."""


def extract_role(document_text: str) -> dict:
    """One-shot structured extraction (not the chat tool-loop). Forces the
    single extraction tool via tool_choice so the reply is always a
    schema-validated JSON object — no free-text JSON parsing needed for the
    common case. Retries once on any failure (missing tool_use block,
    transient API error) before surfacing a clear error to the caller.
    """
    api_key = _resolve_api_key()
    if not api_key:
        raise RuntimeError("No Anthropic API key configured")

    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = _client(api_key).messages.create(
                model=settings.anthropic_model,
                max_tokens=4096,
                system=ROLE_EXTRACTION_SYSTEM_PROMPT,
                tools=[ROLE_EXTRACTION_TOOL],
                tool_choice={"type": "tool", "name": "extract_role_definition"},
                messages=[{"role": "user", "content": f"Document:\n\n{document_text[:60000]}"}],
            )
            block = next((b for b in response.content if b.type == "tool_use"), None)
            if block is None:
                raise ValueError("Model did not return a tool_use block")
            return block.input
        except Exception as exc:  # noqa: BLE001 - deliberately broad, retried once then surfaced
            last_error = exc
    raise RuntimeError(f"Role extraction failed after retry: {last_error}")


FINANCE_EXTRACTION_TOOL = {
    "name": "extract_finance_document",
    "description": "Return structured vendor-payment data extracted from the supplied financial document.",
    "input_schema": {
        "type": "object",
        "properties": {
            "vendorName": {"type": ["string", "null"]},
            "vendorId": {"type": ["string", "null"]},
            "invoiceNumber": {"type": ["string", "null"]},
            "poNumber": {"type": ["string", "null"]},
            "invoiceDate": {"type": ["string", "null"], "description": "YYYY-MM-DD"},
            "dueDate": {"type": ["string", "null"], "description": "YYYY-MM-DD"},
            "paymentDate": {"type": ["string", "null"], "description": "YYYY-MM-DD"},
            "paymentAmount": {"type": ["number", "null"]},
            "currency": {"type": ["string", "null"], "description": "ISO 4217 code, e.g. INR/USD/EUR"},
            "taxAmount": {"type": ["number", "null"]},
            "taxDetails": {
                "type": ["object", "null"],
                "properties": {
                    "gstAmount": {"type": ["number", "null"]},
                    "vatAmount": {"type": ["number", "null"]},
                    "taxRatePct": {"type": ["number", "null"]},
                    "taxType": {"type": ["string", "null"]},
                },
            },
            "deliveryCharges": {"type": ["number", "null"]},
            "isSubscriptionPayment": {"type": "boolean"},
            "subscriptionProvider": {"type": ["string", "null"], "description": "e.g. Microsoft 365, Azure, AWS"},
            "subscriptionCharges": {"type": ["number", "null"]},
            "paymentMethod": {"type": ["string", "null"]},
            "bankDetails": {
                "type": ["object", "null"],
                "properties": {
                    "bankName": {"type": ["string", "null"]},
                    "accountNumber": {"type": ["string", "null"]},
                    "ifscOrSwift": {"type": ["string", "null"]},
                    "accountHolderName": {"type": ["string", "null"]},
                },
            },
            "department": {"type": ["string", "null"]},
            "costCenter": {"type": ["string", "null"]},
            "paymentStatus": {"type": "string", "enum": ["paid", "pending", "overdue", "partially_paid", "cancelled"]},
            "expenseCategory": {"type": "string", "description": "AI-classified, e.g. Software, Travel, Utilities, Office Supplies"},
            "otherFinancialInfo": {"type": "object", "description": "Any other financial detail found that doesn't map to a field above."},
            "summary": {"type": "string"},
            "missingFields": {"type": "array", "items": {"type": "string"}},
            "inconsistencyNotes": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["paymentStatus", "expenseCategory", "summary", "missingFields", "inconsistencyNotes"],
    },
}

# Deliberately the OPPOSITE instruction from ROLE_EXTRACTION_SYSTEM_PROMPT's
# "never leave a field empty, infer reasonable values" — for finance, a
# plausible-looking fabricated figure is far worse than an honest gap.
FINANCE_EXTRACTION_SYSTEM_PROMPT = """You are extracting structured vendor-payment data from a \
financial document (invoice, receipt, payment confirmation, bank statement, or purchase order). \
Unlike a role/persona document, accuracy matters far more than completeness here: extract only \
what the document actually states or what is unambiguously computable from it (e.g. a total that \
is clearly the sum of listed line items). Never invent or guess a financial figure, date, vendor \
identifier, or bank detail. If a field is not present or not confidently determinable, leave it \
null and add its name to missingFields — do not fabricate a plausible-looking value. Flag any \
internal contradiction (e.g. due date before invoice date, tax that doesn't reconcile with the \
stated rate, a total that doesn't match its line items) in inconsistencyNotes. Classify \
expenseCategory using a short, human-readable label (e.g. "Software", "Travel", "Utilities", \
"Office Supplies", "Professional Services") — invent a new label if nothing existing fits; do not \
force-fit into a closed list. Always call extract_finance_document exactly once."""


def _run_finance_extraction(user_content: list[dict]) -> dict:
    """Shared forced-tool-choice call for both extraction paths below — same
    retry-once-then-raise shape as extract_role, but accepts content blocks
    (not just a string) since the native vision/PDF path needs them."""
    api_key = _resolve_api_key()
    if not api_key:
        raise RuntimeError("No Anthropic API key configured")

    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = _client(api_key).messages.create(
                model=settings.anthropic_model,
                max_tokens=8192,
                system=FINANCE_EXTRACTION_SYSTEM_PROMPT,
                tools=[FINANCE_EXTRACTION_TOOL],
                tool_choice={"type": "tool", "name": "extract_finance_document"},
                messages=[{"role": "user", "content": user_content}],
            )
            block = next((b for b in response.content if b.type == "tool_use"), None)
            if block is None:
                raise ValueError("Model did not return a tool_use block")
            return block.input
        except Exception as exc:  # noqa: BLE001 - deliberately broad, retried once then surfaced
            last_error = exc
    raise RuntimeError(f"Finance document extraction failed after retry: {last_error}")


def extract_finance_document(file_bytes: bytes, mime_type: str, filename: str) -> dict:
    """PDF/image-native path — sends the raw file as a document/image content
    block instead of pre-extracted text, so scanned/image documents work
    through the same code path as text-layer PDFs (no OCR library added)."""
    block_type = "image" if mime_type.startswith("image/") else "document"
    content = [
        {
            "type": block_type,
            "source": {"type": "base64", "media_type": mime_type, "data": base64.standard_b64encode(file_bytes).decode()},
        },
        {"type": "text", "text": f"Extract every financial field you can find from '{filename}' using the extract_finance_document tool."},
    ]
    return _run_finance_extraction(content)


def extract_finance_document_from_text(document_text: str, filename: str) -> dict:
    """Text path for spreadsheet/already-text formats (xlsx/xls/csv/docx) —
    spreadsheets aren't a vision problem, and app.rag.loader.load_text
    already gives pandas-clean structured text for them at zero extra cost."""
    content = [{"type": "text", "text": f"Document '{filename}':\n\n{document_text[:60000]}"}]
    return _run_finance_extraction(content)


REPORT_EXTRACTION_TOOL = {
    "name": "extract_report_structure",
    "description": "Return structured tasks extracted from an already-written daily report reply. Do not re-derive from scratch — parse only what the reply states.",
    "input_schema": {
        "type": "object",
        "properties": {
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "priority": {"type": "string", "enum": ["urgent", "high", "medium", "low"]},
                        "category": {"type": "string"},
                        "isOverdue": {"type": "boolean"},
                    },
                    "required": ["title", "priority", "isOverdue"],
                },
            },
            "summary": {"type": "string", "description": "1-2 sentence plain summary of the report."},
        },
        "required": ["tasks", "summary"],
    },
}

REPORT_EXTRACTION_SYSTEM_PROMPT = """You are extracting structured task data from an AI \
agent's already-written daily report reply (a morning to-do list or end-of-day summary). \
Parse what the reply actually says — do not invent new tasks or re-analyze underlying data. \
Assign priority using explicit language cues ("urgent"/"ASAP"/"overdue"/"immediately" → \
urgent; "today"/"before close" → high; otherwise medium/low). Mark isOverdue true only for \
items the reply explicitly describes as overdue/late/missed. If the reply has no actionable \
items, return an empty tasks array and a one-line summary explaining why. Always call \
extract_report_structure exactly once."""


def extract_report_structure(prose_reply: str, report_type: str) -> dict:
    """One-shot forced-tool-choice structuring pass — same pattern as
    extract_role, but operating on prose text an agentic chat turn already
    produced, not a raw document. Retries once before surfacing an error.
    """
    api_key = _resolve_api_key()
    if not api_key:
        raise RuntimeError("No Anthropic API key configured")

    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = _client(api_key).messages.create(
                model=settings.anthropic_model,
                max_tokens=2048,
                system=REPORT_EXTRACTION_SYSTEM_PROMPT,
                tools=[REPORT_EXTRACTION_TOOL],
                tool_choice={"type": "tool", "name": "extract_report_structure"},
                messages=[
                    {
                        "role": "user",
                        "content": f"Report type: {report_type}\n\nReply:\n\n{prose_reply[:20000]}",
                    }
                ],
            )
            block = next((b for b in response.content if b.type == "tool_use"), None)
            if block is None:
                raise ValueError("Model did not return a tool_use block")
            return block.input
        except Exception as exc:  # noqa: BLE001 - deliberately broad, retried once then surfaced
            last_error = exc
    raise RuntimeError(f"Report structuring failed after retry: {last_error}")


RECOMMEND_TOOL = {
    "name": "recommend_next_actions",
    "description": "Return a ranked shortlist of which open tasks to focus on right now, with a one-line rationale for each.",
    "input_schema": {
        "type": "object",
        "properties": {
            "recommendations": {
                "type": "array",
                "description": "Top 3-5 tasks to focus on next, most important first.",
                "items": {
                    "type": "object",
                    "properties": {
                        "taskId": {"type": "string"},
                        "rationale": {"type": "string", "description": "One sentence: why this, why now."},
                    },
                    "required": ["taskId", "rationale"],
                },
            },
            "overallNote": {"type": "string", "description": "One sentence framing the shortlist as a whole."},
        },
        "required": ["recommendations", "overallNote"],
    },
}

RECOMMEND_SYSTEM_PROMPT = """You are triaging a list of open tasks (each with an id, title, \
priority, and whether it's overdue) to tell someone exactly what to work on next. Pick the \
3-5 tasks that most deserve immediate attention — weigh overdue urgent/high items heaviest, \
then urgent/high items generally, then anything blocking other work. Give each a one-sentence, \
concrete rationale (not a restatement of its priority label). Never invent a taskId that isn't \
in the input. If the input has no tasks, return an empty recommendations array and an \
overallNote saying there's nothing open. Always call recommend_next_actions exactly once."""


def recommend_next_actions(tasks: list[dict]) -> dict:
    """One-shot forced-tool-choice ranking pass — same pattern as
    extract_report_structure, operating on today's open tasks instead of a
    report reply. Retries once before surfacing an error.
    """
    api_key = _resolve_api_key()
    if not api_key:
        raise RuntimeError("No Anthropic API key configured")

    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = _client(api_key).messages.create(
                model=settings.anthropic_model,
                max_tokens=1024,
                system=RECOMMEND_SYSTEM_PROMPT,
                tools=[RECOMMEND_TOOL],
                tool_choice={"type": "tool", "name": "recommend_next_actions"},
                messages=[{"role": "user", "content": f"Open tasks:\n\n{json.dumps(tasks)[:20000]}"}],
            )
            block = next((b for b in response.content if b.type == "tool_use"), None)
            if block is None:
                raise ValueError("Model did not return a tool_use block")
            return block.input
        except Exception as exc:  # noqa: BLE001 - deliberately broad, retried once then surfaced
            last_error = exc
    raise RuntimeError(f"Task recommendation failed after retry: {last_error}")


PLAN_TOOL = {
    "name": "plan_execution",
    "description": (
        "Decide whether this request can be handled by one general-purpose pass, or "
        "should be decomposed and delegated to specialized sub-agents that can gather "
        "information in parallel."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "reasoning": {
                "type": "string",
                "description": "One sentence explaining why this mode (and these assignments, if any) were chosen.",
            },
            "mode": {
                "type": "string",
                "enum": ["general", "simple", "delegate"],
                "description": (
                    "'general' for pure general-knowledge/coding/math/casual requests that need "
                    "none of this app's own data or tools — answerable from training knowledge "
                    "alone. 'simple' for anything needing this app's own data (CRM, Outlook, "
                    "calendar, documents, business context) via a single pass, or a follow-up in "
                    "an ongoing tool-using conversation. 'delegate' only when the request clearly "
                    "spans two or more distinct domains below and gathering them in parallel "
                    "would clearly help."
                ),
            },
            "assignments": {
                "type": "array",
                "description": "Only populated when mode is 'delegate'.",
                "items": {
                    "type": "object",
                    "properties": {
                        "agent": {"type": "string", "enum": list(SPECIALISTS.keys())},
                        "task": {"type": "string", "description": "The specific sub-task for this agent."},
                    },
                    "required": ["agent", "task"],
                },
            },
        },
        "required": ["reasoning", "mode", "assignments"],
    },
}

PLAN_SYSTEM_PROMPT = (
    "You are a routing planner for an enterprise AI assistant with these specialists:\n"
    + "\n".join(f"- {key}: {spec['label']}" for key, spec in SPECIALISTS.items())
    + """

Choose 'general' for requests answerable from general knowledge alone and needing no lookup — \
general-knowledge questions, programming/code questions, math, writing help, casual \
conversation, quick summaries of text already in the message. These get routed to a faster, \
cheaper model, so only choose it when you're confident no tool or business data is needed.

Choose 'simple' for anything needing this app's own data — CRM, Outlook/email, calendar, \
documents, business context — via one pass, or any follow-up inside an ongoing tool-using \
conversation. This is still the majority of "real work" requests.

Choose 'delegate' only when the request explicitly spans two or more of the specialists above \
and doing so in parallel would clearly help (e.g. "pull my CRM follow-ups, check my calendar \
for today, and summarize new emails").

When genuinely unsure between 'general' and 'simple', choose 'simple' — a wrong 'general' guess \
means a real business question gets answered without checking real data, which is worse than \
the extra cost of 'simple' answering a question it didn't strictly need tools for."""
)


def classify_request(
    input_items: list[dict],
    *,
    organization_id: str | None = None,
    user_id: str = "",
    conversation_id: str = "",
) -> dict:
    """One-shot forced-tool-choice routing pass, run by app.agent.orchestrator
    before every chat turn — same pattern as extract_role/extract_report_structure.
    Raises rather than guessing on failure; the caller treats any exception as
    'simple' and falls back to the unchanged single-loop path.
    """
    api_key = _resolve_api_key()
    if not api_key:
        raise RuntimeError("No Anthropic API key configured")

    with traced_llm_call(
        "classify",
        organization_id=organization_id,
        user_id=user_id,
        conversation_id=conversation_id,
        provider="anthropic",
        model=settings.anthropic_routing_model,
    ) as usage:
        response = _client(api_key).messages.create(
            model=settings.anthropic_routing_model,
            max_tokens=1024,
            system=PLAN_SYSTEM_PROMPT,
            tools=[PLAN_TOOL],
            tool_choice={"type": "tool", "name": "plan_execution"},
            messages=_to_anthropic_messages(input_items),
        )
        usage["input_tokens"] = response.usage.input_tokens
        usage["output_tokens"] = response.usage.output_tokens
    block = next((b for b in response.content if b.type == "tool_use"), None)
    if block is None:
        raise ValueError("Planner did not return a tool_use block")
    return block.input


CRITIQUE_TOOL = {
    "name": "critique_response",
    "description": "Judge whether a draft reply fully addresses every part of the user's request.",
    "input_schema": {
        "type": "object",
        "properties": {
            "complete": {
                "type": "boolean",
                "description": "True only if every part of the user's request is addressed. False if anything was asked for and skipped, guessed at instead of looked up, or left vague where a tool could have gotten a real answer.",
            },
            "missing": {
                "type": "string",
                "description": "If not complete, a precise, actionable description of what's missing. Empty string if complete.",
            },
        },
        "required": ["complete", "missing"],
    },
}

CRITIQUE_SYSTEM_PROMPT = """You are a strict but fair reviewer checking one AI assistant reply against the \
request that prompted it. Only flag genuine gaps — a part of the request that was ignored, or a claim \
made without checking a tool that was available for it. Do not flag stylistic choices, brevity, or \
reasonable interpretations of an ambiguous request. Default to complete=true unless there's a concrete, \
nameable gap. Always call critique_response exactly once."""


def critique_response(
    user_message: str,
    draft_reply: str,
    *,
    organization_id: str | None = None,
    user_id: str = "",
    conversation_id: str = "",
) -> dict:
    """One-shot forced-tool-choice reflection pass, run by app.agent.orchestrator
    after every reply. Same pattern as classify_request. Raises rather than
    guessing on failure; the caller treats any exception as complete=true and
    returns the draft unchanged — reflection failing must never block a reply.
    """
    api_key = _resolve_api_key()
    if not api_key:
        raise RuntimeError("No Anthropic API key configured")

    with traced_llm_call(
        "critique",
        organization_id=organization_id,
        user_id=user_id,
        conversation_id=conversation_id,
        provider="anthropic",
        model=settings.anthropic_routing_model,
    ) as usage:
        response = _client(api_key).messages.create(
            model=settings.anthropic_routing_model,
            max_tokens=512,
            system=CRITIQUE_SYSTEM_PROMPT,
            tools=[CRITIQUE_TOOL],
            tool_choice={"type": "tool", "name": "critique_response"},
            messages=[{"role": "user", "content": f"Request:\n{user_message}\n\nDraft reply:\n{draft_reply}"}],
        )
        usage["input_tokens"] = response.usage.input_tokens
        usage["output_tokens"] = response.usage.output_tokens
    block = next((b for b in response.content if b.type == "tool_use"), None)
    if block is None:
        raise ValueError("Critique did not return a tool_use block")
    return block.input


def call(
    input_items: list[dict],
    on_event: Callable[[dict], None] | None = None,
    system_prompt: str | None = None,
    tools: list[dict] | None = None,
    cancel_event=None,
    *,
    model: str | None = None,
    organization_id: str | None = None,
    user_id: str = "",
    conversation_id: str = "",
) -> list[dict]:
    """Runs one planner round. If on_event is given, streams two kinds of
    live events as they happen: {"type": "progress", "tool": name} the
    instant a tool_use block starts (before its arguments finish streaming —
    all we need is the name), and {"type": "delta", "text": ...} for each
    text token. Always returns the same normalized items as before,
    regardless of whether on_event was passed. system_prompt overrides the
    default persona (see app.agent.personas) for this call only. tools
    overrides the full registry (see app.tools.registry.get_tool_definitions)
    for this call only — None means the full registry, same as before this
    parameter existed; pass [] for a tool-free call (e.g. synthesis).
    cancel_event (see app.agent.cancellation), if set mid-stream, closes the
    stream and returns whatever text had been generated so far as a normal
    assistant message — a cancelled turn is a short answer, not an error.
    Transient Anthropic errors (overloaded/rate-limited/5xx) are retried with
    a short backoff, but only while nothing has been streamed to the user yet
    for this attempt — once a token has gone out via on_event, a retry would
    either duplicate it or need to guess how to resume, so the error is
    raised as-is instead (the caller/orchestrator already degrades this to a
    generic reply rather than crashing the request).
    """
    api_key = _resolve_api_key()
    if not api_key:
        raise RuntimeError("No Anthropic API key configured")

    resolved_model = model or settings.anthropic_model
    accumulated_text: list[str] = []

    with traced_llm_call(
        "planner",
        organization_id=organization_id,
        user_id=user_id,
        conversation_id=conversation_id,
        provider="anthropic",
        model=resolved_model,
    ) as usage:
        for attempt in range(_MAX_CALL_ATTEMPTS):
            emitted_any = False
            try:
                with _client(api_key).messages.stream(
                    model=resolved_model,
                    max_tokens=1024,
                    system=[
                        {
                            "type": "text",
                            "text": system_prompt or SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    tools=_cache_last_tool(TOOL_DEFINITIONS if tools is None else tools),
                    messages=_to_anthropic_messages(input_items),
                ) as stream:
                    cancelled = False
                    for event in stream:
                        if cancel_event is not None and cancel_event.is_set():
                            cancelled = True
                            break
                        if event.type == "content_block_start" and event.content_block.type == "tool_use":
                            emitted_any = True
                            if on_event:
                                on_event({"type": "progress", "tool": event.content_block.name})
                        elif event.type == "content_block_delta" and event.delta.type == "text_delta":
                            emitted_any = True
                            accumulated_text.append(event.delta.text)
                            if on_event:
                                on_event({"type": "delta", "text": event.delta.text})

                    if cancelled:
                        stream.close()
                        usage["input_tokens"] = 0
                        usage["output_tokens"] = 0
                        return [
                            {
                                "type": "message",
                                "role": "assistant",
                                "content": [{"type": "output_text", "text": "".join(accumulated_text)}],
                            }
                        ]

                    response = stream.get_final_message()
                usage["input_tokens"] = response.usage.input_tokens
                usage["output_tokens"] = response.usage.output_tokens
                break
            except Exception as exc:
                if not emitted_any and attempt < _MAX_CALL_ATTEMPTS - 1 and _is_retryable(exc):
                    time.sleep(0.5 * (2**attempt))
                    continue
                raise


CUSTOMER_ACTIVITY_TOOL = {
    "name": "analyze_customer_activity",
    "description": "Judge today's CRM/email activity: what should have been prioritized, and which important emails were missed.",
    "input_schema": {
        "type": "object",
        "properties": {
            "prioritization": {
                "type": "array",
                "description": "3-5 businesses/deals that most deserved attention today, most important first.",
                "items": {
                    "type": "object",
                    "properties": {
                        "businessName": {"type": "string"},
                        "rationale": {"type": "string", "description": "One sentence: why this, why today."},
                    },
                    "required": ["businessName", "rationale"],
                },
            },
            "missedImportantEmails": {
                "type": "array",
                "description": "Emails that appear important and unaddressed today. Only include exact-confidence CRM matches as definite; hedge fuzzy matches explicitly in the note.",
                "items": {
                    "type": "object",
                    "properties": {
                        "emailId": {"type": "string"},
                        "subject": {"type": "string"},
                        "note": {"type": "string"},
                    },
                    "required": ["emailId", "subject", "note"],
                },
            },
            "aiSummary": {"type": "string", "description": "3-5 sentence plain-language summary of today's customer activity."},
        },
        "required": ["prioritization", "missedImportantEmails", "aiSummary"],
    },
}

CUSTOMER_ACTIVITY_SYSTEM_PROMPT = """You are triaging one business's CRM and email activity for today \
against data that has already been deterministically gathered — do not invent facts not present in \
the input. The input's correlatedEmails carry a matchConfidence field ('exact', 'domain', 'fuzzy'): \
treat 'exact' matches as fact, and explicitly hedge ('possibly related to...') anything described only \
as 'fuzzy'. Prioritize businesses with unactioned open deals/quotes, especially ones flagged isFollowUp \
or nearing/past their expected close date, over ones already actionedToday. Flag an email as \
missed-important only if it is unread, marked high importance, or correlated (any confidence) to a \
business with an open/follow-up deal and no matching CRM update today — never flag routine/automated \
mail. If there is no real activity to report, say so plainly rather than inventing filler. Always call \
analyze_customer_activity exactly once."""


def analyze_customer_activity(payload: dict) -> dict:
    """One-shot forced-tool-choice triage pass — same pattern as
    extract_report_structure/recommend_next_actions, operating on today's
    deterministically-gathered CRM+email activity (see
    backend/src/crm/customer-activity.service.ts). Retries once before
    surfacing an error.
    """
    api_key = _resolve_api_key()
    if not api_key:
        raise RuntimeError("No Anthropic API key configured")

    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = _client(api_key).messages.create(
                model=settings.anthropic_model,
                max_tokens=2048,
                system=CUSTOMER_ACTIVITY_SYSTEM_PROMPT,
                tools=[CUSTOMER_ACTIVITY_TOOL],
                tool_choice={"type": "tool", "name": "analyze_customer_activity"},
                messages=[
                    {
                        "role": "user",
                        "content": f"Today's customer activity data:\n\n{json.dumps(payload, default=str)[:40000]}",
                    }
                ],
            )
            block = next((b for b in response.content if b.type == "tool_use"), None)
            if block is None:
                raise ValueError("Model did not return a tool_use block")
            return block.input
        except Exception as exc:  # noqa: BLE001 - deliberately broad, retried once then surfaced
            last_error = exc
    raise RuntimeError(f"Customer activity analysis failed after retry: {last_error}")


FINANCE_ACTIVITY_TOOL = {
    "name": "analyze_finance_activity",
    "description": "Judge today's vendor payment activity: what should be prioritized, and any anomalies worth flagging.",
    "input_schema": {
        "type": "object",
        "properties": {
            "prioritizedPayments": {
                "type": "array",
                "description": "3-5 vendor payments most deserving attention right now (overdue, due soon, or otherwise flagged), most urgent first.",
                "items": {
                    "type": "object",
                    "properties": {
                        "vendorName": {"type": "string"},
                        "documentId": {"type": "string"},
                        "amount": {"type": "number"},
                        "rationale": {"type": "string", "description": "One sentence: why this, why now."},
                    },
                    "required": ["vendorName", "documentId", "rationale"],
                },
            },
            "flaggedAnomalies": {
                "type": "array",
                "description": "Anomalies worth a human look, using only what's present in the input — possible duplicate payments, subscription cost spikes, missing/inconsistent fields.",
                "items": {
                    "type": "object",
                    "properties": {
                        "documentId": {"type": "string"},
                        "vendorName": {"type": "string"},
                        "anomalyType": {"type": "string"},
                        "note": {"type": "string"},
                    },
                    "required": ["vendorName", "anomalyType", "note"],
                },
            },
            "aiSummary": {"type": "string", "description": "3-5 sentence plain-language summary of today's vendor payment posture."},
        },
        "required": ["prioritizedPayments", "flaggedAnomalies", "aiSummary"],
    },
}

FINANCE_ACTIVITY_SYSTEM_PROMPT = """You are triaging one business's vendor payment activity for today \
against data that has already been deterministically gathered — do not invent facts not present in \
the input. The input's overdueAndUpcomingPayments and possibleDuplicates arrays are the ONLY sources \
that carry a real documentId — prioritizedPayments and flaggedAnomalies must be built exclusively from \
those two arrays, never from vendorSpending/categorySpending/microsoftSubscriptionCosts (those are \
aggregate breakdowns with no per-document id, and a payment already fully paid with no due-soon/overdue \
flag is not something to prioritize regardless of its amount). If overdueAndUpcomingPayments is empty, \
prioritizedPayments must be an empty array — do not backfill it with an already-settled payment or a \
placeholder id. Likewise, if possibleDuplicates is empty, flaggedAnomalies must be empty unless a real \
subscription cost spike is evident in microsoftSubscriptionCosts (describe it without a documentId in \
that case). Never invent a vendor, amount, or anomaly not present in the input. If there is nothing \
notable to report, say so plainly in aiSummary rather than inventing filler. Always call \
analyze_finance_activity exactly once."""


def analyze_finance_activity(payload: dict) -> dict:
    """One-shot forced-tool-choice triage pass — same pattern as
    analyze_customer_activity, operating on today's deterministically-
    gathered vendor payment activity (see
    backend/src/finance/finance-summary.service.ts). Retries once before
    surfacing an error.
    """
    api_key = _resolve_api_key()
    if not api_key:
        raise RuntimeError("No Anthropic API key configured")

    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = _client(api_key).messages.create(
                model=settings.anthropic_model,
                max_tokens=2048,
                system=FINANCE_ACTIVITY_SYSTEM_PROMPT,
                tools=[FINANCE_ACTIVITY_TOOL],
                tool_choice={"type": "tool", "name": "analyze_finance_activity"},
                messages=[
                    {
                        "role": "user",
                        "content": f"Today's vendor payment activity data:\n\n{json.dumps(payload, default=str)[:40000]}",
                    }
                ],
            )
            block = next((b for b in response.content if b.type == "tool_use"), None)
            if block is None:
                raise ValueError("Model did not return a tool_use block")
            return block.input
        except Exception as exc:  # noqa: BLE001 - deliberately broad, retried once then surfaced
            last_error = exc
    raise RuntimeError(f"Finance activity analysis failed after retry: {last_error}")

    return _normalize_response(response)
