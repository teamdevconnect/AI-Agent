"""Deterministic, zero-cost short-circuit tried before the real
app.agent.anthropic_client.classify_request call in app.agent.orchestrator.run().
Matches ONLY unambiguous social pleasantries — greetings, thanks/closings,
"how are you" small talk — against the ENTIRE normalized last user message,
never a substring. Deliberately excludes bare affirmatives/confirmations
("ok", "yes", "sure", "sounds good", ...): in a multi-turn tool-using
conversation one of those could be confirming a pending CRM/email action, and
misrouting it to the tool-free Groq 'general' path would silently drop a
real intent. Also excludes bare "morning"/"afternoon"/"evening" (no
"good "/greeting prefix) for the same reason — those are plausible answers to
a scheduling question, not just a greeting.

When in doubt, return None and let the real classify_request call decide —
this module only ever narrows the trivial case, never guesses on an
ambiguous one.
"""

import re

# Every entry here MUST be its own post-normalization form: _normalize()
# strips punctuation (including apostrophes), so "what's up" is never
# produced — only "whats up" is; don't add apostrophe'd forms, they're
# unreachable dead entries.
_TRIVIAL_PHRASES = {
    # Pure greetings
    "hi", "hello", "hey", "hiya", "yo",
    "good morning", "good afternoon", "good evening",
    # Pure thanks / closings
    "thanks", "thank you", "thanks a lot", "many thanks",
    "bye", "goodbye", "see you", "see ya", "take care",
    # "How are you"-style small talk
    "how are you", "how are you doing", "hows it going", "whats up",
}

_PUNCT_RE = re.compile(r"[^\w\s]")


def _normalize(text: str) -> str:
    text = _PUNCT_RE.sub("", text.strip().lower())
    return re.sub(r"\s+", " ", text).strip()


def trivial_plan(messages: list[dict]) -> dict | None:
    """Returns a synthetic classify_request-shaped plan
    ({"mode": "general", "assignments": [], "reasoning": None}) if the last
    message is an exact, whole-message match against the trivial-phrase
    allow-list; otherwise None, meaning "fall through to the real
    classify_request call". Never raises — a malformed/empty messages list
    just returns None, same as any other non-match.
    """
    if not messages:
        return None
    content = messages[-1].get("content", "")
    if not isinstance(content, str):
        return None
    if _normalize(content) in _TRIVIAL_PHRASES:
        return {"mode": "general", "assignments": [], "reasoning": None}
    return None
