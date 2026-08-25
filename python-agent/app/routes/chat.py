import json
import queue
import threading
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agent import cancellation
from app.agent.graph import final_text
from app.agent.orchestrator import run as run_agent
from app.agent.personas import resolve_persona
from app.billing import client as billing_client
from app.billing.client import InsufficientCreditsError
from app.memory.conversation_store import get_recent_messages
from app.models.schemas import ChatRequest, ChatResponse
from app.observability.guardrails import redact_secrets
from app.security import get_current_user

router = APIRouter()


def _build_messages(payload: ChatRequest) -> list[dict]:
    history = get_recent_messages(payload.conversation_id)
    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    messages.append({"role": "user", "content": payload.message})
    return messages


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: dict = Depends(get_current_user)):
    organization_id = user.get("organizationId")
    request_id = str(uuid.uuid4())

    # Hard stop — reserved BEFORE run_agent() is ever invoked, a structural
    # early return rather than a downstream check. Raises InsufficientCreditsError
    # (-> HTTP 402) on insufficient balance with AutoPay off/failed; see
    # app.billing.client.reserve.
    try:
        billing_client.reserve(organization_id, payload.user_id, request_id, payload.conversation_id)
    except InsufficientCreditsError as exc:
        raise billing_client.to_http_exception(exc) from exc

    persona = resolve_persona(payload.agent_id, organization_id)
    try:
        result = run_agent(
            {
                "messages": _build_messages(payload),
                "pending_calls": [],
                "tools_used": [],
                "rounds": 0,
                "provider": "",
                "user_id": payload.user_id,
                "organization_id": organization_id,
                "conversation_id": payload.conversation_id,
                "system_prompt": persona.system_prompt,
                "allowed_tools": persona.allowed_tools,
                "model_tier": persona.model_tier,
                "request_id": request_id,
            }
        )
    except Exception:
        billing_client.release(organization_id, payload.user_id, request_id)
        raise

    billing_client.settle(organization_id, payload.user_id, request_id)
    return ChatResponse(reply=redact_secrets(final_text(result)), tools_used=result["tools_used"])


@router.post("/chat/stream")
def chat_stream(payload: ChatRequest, user: dict = Depends(get_current_user)):
    organization_id = user.get("organizationId")
    request_id = str(uuid.uuid4())

    try:
        billing_client.reserve(organization_id, payload.user_id, request_id, payload.conversation_id)
    except InsufficientCreditsError as exc:
        # Values pulled out into plain locals before the except block ends —
        # Python implicitly `del`s the `as exc` binding on exit, but the
        # generator below only actually runs later (when Starlette iterates
        # it to send the response, well after this except block has
        # exited), so a closure over `exc` itself would raise
        # UnboundLocalError at send time instead of returning the error
        # frame (caught live: curl saw a broken/empty response, exit 18).
        error_message = exc.message
        available_credits = exc.available_credits
        required_credits = exc.required_credits

        # Same hard stop as the non-streaming route, in SSE shape — no
        # worker thread is started, so run_agent() (and therefore any LLM
        # call) never happens for this request.
        def error_only():
            yield f"data: {json.dumps({'type': 'billing_error', 'code': 'INSUFFICIENT_BALANCE', 'message': error_message, 'availableCredits': available_credits, 'requiredCredits': required_credits})}\n\n"

        return StreamingResponse(error_only(), media_type="text/event-stream")

    messages = _build_messages(payload)
    persona = resolve_persona(payload.agent_id, organization_id)

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
                        "organization_id": organization_id,
                        "conversation_id": payload.conversation_id,
                        "on_event": q.put,
                        "system_prompt": persona.system_prompt,
                        "allowed_tools": persona.allowed_tools,
                        "model_tier": persona.model_tier,
                        "request_id": request_id,
                    }
                )
                billing_client.settle(organization_id, payload.user_id, request_id)
                q.put({"type": "done", "reply": redact_secrets(final_text(result)), "tools_used": result["tools_used"]})
            except Exception as exc:
                billing_client.release(organization_id, payload.user_id, request_id)
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
