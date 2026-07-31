<<<<<<< HEAD
=======

from fastapi import APIRouter, Depends

from app.agent.graph import final_text, get_graph
from app.memory.conversation_store import get_recent_messages
from app.models.schemas import ChatRequest, ChatResponse
=======
>>>>>>> 775ce31508926519369b07d336c2c47aff4d3b1d
import json
import queue
import threading

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agent import cancellation
from app.agent.graph import final_text
from app.agent.orchestrator import run as run_agent
from app.agent.personas import resolve_persona
from app.memory.conversation_store import get_recent_messages
from app.models.schemas import ChatRequest, ChatResponse
from app.observability.guardrails import redact_secrets
from app.security import get_current_user

router = APIRouter()


<<<<<<< HEAD
=======

@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: dict = Depends(get_current_user)):
    history = get_recent_messages(payload.conversation_id)
    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    messages.append({"role": "user", "content": payload.message})

    result = get_graph().invoke(
        {
            "messages": messages,

>>>>>>> 775ce31508926519369b07d336c2c47aff4d3b1d
def _build_messages(payload: ChatRequest) -> list[dict]:
    history = get_recent_messages(payload.conversation_id)
    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    messages.append({"role": "user", "content": payload.message})
    return messages


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: dict = Depends(get_current_user)):
    persona = resolve_persona(payload.agent_id, user.get("organizationId"))
    result = run_agent(
        {
            "messages": _build_messages(payload),
<<<<<<< HEAD
=======
 6a60a8648 (Initial AI Agent source code)
>>>>>>> 775ce31508926519369b07d336c2c47aff4d3b1d
            "pending_calls": [],
            "tools_used": [],
            "rounds": 0,
            "provider": "",
            "user_id": payload.user_id,
            "organization_id": user.get("organizationId"),
            "conversation_id": payload.conversation_id,
<<<<<<< HEAD
            "system_prompt": persona.system_prompt,
            "allowed_tools": persona.allowed_tools,
            "model_tier": persona.model_tier,
=======

        }
    )

    return ChatResponse(reply=final_text(result), tools_used=result["tools_used"])

            "system_prompt": resolve_system_prompt(payload.agent_id),
>>>>>>> 775ce31508926519369b07d336c2c47aff4d3b1d
        }
    )

    return ChatResponse(reply=redact_secrets(final_text(result)), tools_used=result["tools_used"])


@router.post("/chat/stream")
def chat_stream(payload: ChatRequest, user: dict = Depends(get_current_user)):
    messages = _build_messages(payload)

    persona = resolve_persona(payload.agent_id, user.get("organizationId"))

    def event_source():
        q: "queue.Queue[dict | None]" = queue.Queue()

        def run():
            try:
                result = run_agent(
                    {
                        "messages": messages,
                        "pending_calls": [],
                        "tools_used": [],
                        "rounds": 0,
                        "provider": "",
                        "user_id": payload.user_id,
                        "organization_id": user.get("organizationId"),
                        "conversation_id": payload.conversation_id,
                        "on_event": q.put,
                        "system_prompt": persona.system_prompt,
                        "allowed_tools": persona.allowed_tools,
                        "model_tier": persona.model_tier,
                    }
                )
                q.put({"type": "done", "reply": redact_secrets(final_text(result)), "tools_used": result["tools_used"]})
            except Exception as exc:
                q.put({"type": "error", "message": str(exc)})
            finally:
                q.put(None)

        threading.Thread(target=run, daemon=True).start()
        while (item := q.get()) is not None:
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")


class CancelRequest(BaseModel):
    conversation_id: str


@router.post("/chat/stream/cancel")
def cancel_stream(payload: CancelRequest, user: dict = Depends(get_current_user)):
    """Signals app.agent.cancellation for an in-flight /chat/stream request on
    this conversation — a no-op (cancelled: false) if nothing is running for
    it, e.g. it already finished before this arrived."""
    return {"cancelled": cancellation.request_cancel(payload.conversation_id)}
<<<<<<< HEAD
=======
 (Initial AI Agent source code)
>>>>>>> 775ce31508926519369b07d336c2c47aff4d3b1d
