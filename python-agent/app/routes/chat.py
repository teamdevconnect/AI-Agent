from fastapi import APIRouter, Depends

from app.agent.graph import final_text, get_graph
from app.memory.conversation_store import get_recent_messages
from app.models.schemas import ChatRequest, ChatResponse
from app.security import get_current_user

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: dict = Depends(get_current_user)):
    history = get_recent_messages(payload.conversation_id)
    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    messages.append({"role": "user", "content": payload.message})

    result = get_graph().invoke(
        {
            "messages": messages,
            "pending_calls": [],
            "tools_used": [],
            "rounds": 0,
            "provider": "",
            "user_id": payload.user_id,
            "conversation_id": payload.conversation_id,
        }
    )

    return ChatResponse(reply=final_text(result), tools_used=result["tools_used"])
