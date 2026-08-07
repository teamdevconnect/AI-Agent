from bson import ObjectId

from app.cache.cache import cache_key, get_json, set_json
from app.config import settings
from app.memory.mongo_client import get_db

# Short-term "conversation state" cache — a burst of agent activity within
# one turn (e.g. the orchestrator's specialist fan-out, app.agent.orchestrator)
# would otherwise re-read the same conversation doc from Mongo several times
# in a few seconds. Deliberately short: the backend appends the user's and
# assistant's messages right after this read, so a longer TTL would risk
# serving stale history on the next turn.
_TTL_SECONDS = 15


def get_recent_messages(conversation_id: str, limit: int = settings.conversation_history_limit) -> list[dict]:
    """Reads conversation history the NestJS backend already persisted.

    The backend owns writes to this collection (it appends both the user's
    message and the agent's reply after each turn); the agent only reads it
    to reconstruct context for the LangGraph loop.
    """
    key = cache_key("conversation", conversation_id, {"limit": limit})
    cached = get_json(key)
    if cached is not None:
        return cached

    try:
        doc = get_db().conversations.find_one({"_id": ObjectId(conversation_id)})
    except Exception:
        return []
    messages = doc.get("messages", [])[-limit:] if doc else []
    set_json(key, messages, _TTL_SECONDS)
    return messages
