"""Centralized prompt registry — named, versioned prompt templates with
variable substitution, so prompt content lives in one place (app.prompts.definitions)
instead of scattered across business logic modules.

Uses string.Template ($var syntax), not str.format() — several existing
prompts in this app legitimately contain literal curly braces (e.g.
anthropic_client.ROLE_EXTRACTION_SYSTEM_PROMPT shows the model an example
"{name}" placeholder as literal text) which .format() would misinterpret as
a template variable and crash on. $var has no such collision.

Scope note: this is a working, versioned, in-code registry — it satisfies
"no hardcoded prompts inside business logic" for the prompts registered here
(app.agent.llm_client.SYSTEM_PROMPT and app.agent.specialists's specialist
prompts). It is NOT a database-backed hot-reloadable registry with runtime
rollback or A/B testing — versioning/rollback go through normal git history
for now. The narrower one-shot extraction/critique/plan prompts in
app.agent.anthropic_client and app.agent.orchestrator are not yet migrated
here — flagged as a follow-up rather than risked in this pass, since it
would mean re-touching several already-verified call sites for prompts with
lower reuse value than the two migrated here.
"""

from dataclasses import dataclass
from string import Template


@dataclass
class Prompt:
    name: str
    version: int
    template: str

    def render(self, **variables) -> str:
        return Template(self.template).safe_substitute(**variables) if variables else self.template


_REGISTRY: dict[str, Prompt] = {}


def register(prompt: Prompt) -> Prompt:
    _REGISTRY[prompt.name] = prompt
    return prompt


def get(name: str) -> Prompt:
    prompt = _REGISTRY.get(name)
    if prompt is None:
        raise KeyError(f"Unknown prompt: {name}")
    return prompt


def render(name: str, **variables) -> str:
    return get(name).render(**variables)


def list_prompts() -> list[dict]:
    return [{"name": p.name, "version": p.version} for p in _REGISTRY.values()]
