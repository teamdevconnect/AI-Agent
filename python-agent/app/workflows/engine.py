"""Generic workflow engine — a named, inspectable unit of automation
decoupled from any specific API route (see app.workflows.definitions for the
actual workflows).

Scheduling stays owned by the NestJS backend (@nestjs/schedule, already
wired to /reports/generate and /store-settings/run-now) — this engine
answers "what happens", not "when". Workflows here are triggered by an HTTP
call (app.routes.workflows) or a domain event (app.events.bus), never by
their own wall-clock timer, so there's exactly one scheduling system rather
than two that could drift out of sync.
"""

import logging
from dataclasses import dataclass
from typing import Callable

logger = logging.getLogger(__name__)


@dataclass
class Workflow:
    name: str
    description: str
    run: Callable[[dict], dict]


_WORKFLOWS: dict[str, Workflow] = {}


def register(workflow: Workflow) -> None:
    _WORKFLOWS[workflow.name] = workflow


def list_workflows() -> list[dict]:
    return [{"name": w.name, "description": w.description} for w in _WORKFLOWS.values()]


def run_workflow(name: str, context: dict | None = None) -> dict:
    workflow = _WORKFLOWS.get(name)
    if workflow is None:
        raise ValueError(f"Unknown workflow: {name}")
    logger.info("Running workflow '%s'", name)
    result = workflow.run(context or {})
    logger.info("Workflow '%s' completed", name)
    return result
