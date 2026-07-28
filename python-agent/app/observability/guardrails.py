"""Output guardrail: redacts text that looks like a credential before a
reply leaves this service. A last-resort safety net, not the primary
defense — the primary defenses are per-request secrets (this app never puts
real credentials in a place the model would read back, e.g. API keys are
resolved server-side in app.agent.anthropic_client._resolve_api_key, never
included in messages sent to Claude) and the prompt-injection instruction in
app.agent.llm_client.SYSTEM_PROMPT. This exists for the residual case: a
tool result (a document, an email) happens to contain something that looks
like a live credential, and the model quotes it back verbatim.

Known limitation: only applied to the final aggregated reply (app.routes.chat's
non-streaming response, and the streaming path's terminal "done" event) — the
token-by-token "delta" events sent during streaming are NOT retroactively
redacted, since they've already reached the client by the time the full text
is known. Flagged rather than silently accepted; closing it fully would mean
buffering the whole reply before streaming anything, which defeats the point
of streaming.
"""

import re

_PATTERNS = [
    re.compile(r"sk-ant-[a-zA-Z0-9\-_]{20,}"),  # Anthropic API key
    re.compile(r"sk-[a-zA-Z0-9]{20,}"),  # generic OpenAI-style API key
    re.compile(r"AKIA[0-9A-Z]{16}"),  # AWS access key id
    re.compile(r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}"),  # JWT
]

_REDACTED = "[redacted]"


def redact_secrets(text: str) -> str:
    for pattern in _PATTERNS:
        text = pattern.sub(_REDACTED, text)
    return text
