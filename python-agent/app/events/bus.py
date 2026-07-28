"""Minimal in-process domain event bus — pub/sub for moments this app
already produces (currently: a document finishing upload/ingest), consumed
by app.workflows to trigger event-driven automation without the emitting
code needing to know what, if anything, reacts to it.

Deliberately in-process, not a message broker (no Redis Streams/Kafka
available in this dev environment — see python-agent/.env's own note about
Docker Desktop being unavailable here) — but the on()/emit() interface is
broker-agnostic, so swapping the internals later wouldn't change callers.

Fail-open per handler: one handler raising must never break another handler,
or the code that emitted the event in the first place.
"""

import logging
from collections import defaultdict
from typing import Callable

logger = logging.getLogger(__name__)

_handlers: dict[str, list[Callable[[dict], None]]] = defaultdict(list)


def on(event_name: str):
    def decorator(handler: Callable[[dict], None]) -> Callable[[dict], None]:
        _handlers[event_name].append(handler)
        return handler

    return decorator


def emit(event_name: str, payload: dict) -> None:
    for handler in _handlers.get(event_name, []):
        try:
            handler(payload)
        except Exception:
            logger.exception("Event handler for '%s' failed", event_name)
