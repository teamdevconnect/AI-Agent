"""In-memory per-conversation cancellation registry for streaming chat turns
(see app.routes.chat's /chat/stream and the new /chat/stream/cancel).
Deliberately in-process, like app.events.bus — a threading.Event set by a
cancel request, checked inside the streaming loop
(app.agent.anthropic_client.call) and between planner rounds
(app.agent.graph.should_continue). Cancelling stops further generation but
keeps whatever text was produced so far — a user who clicks "stop" wants
the partial answer kept, not thrown away.
"""

import threading

_events: dict[str, threading.Event] = {}


def start(conversation_id: str) -> threading.Event:
    event = threading.Event()
    _events[conversation_id] = event
    return event


def request_cancel(conversation_id: str) -> bool:
    event = _events.get(conversation_id)
    if event is None:
        return False
    event.set()
    return True


def finish(conversation_id: str) -> None:
    _events.pop(conversation_id, None)
