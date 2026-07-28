from bson import ObjectId

<<<<<<< HEAD
from app.memory.mongo_client import get_db

=======
from app.cache.cache import cache_key, get_json, set_json
from app.memory.mongo_client import get_db

# Short-term "conversation state" cache — a burst of agent activity within
# one turn (e.g. the orchestrator's specialist fan-out, app.agent.orchestrator)
# would otherwise re-read the same conversation doc from Mongo several times
# in a few seconds. Deliberately short: the backend appends the user's and
# assistant's messages right after this read, so a longer TTL would risk
# serving stale history on the next turn.
_TTL_SECONDS = 15

>>>>>>> 6a60a8648 (Initial AI Agent source code)

def get_recent_messages(conversation_id: str, limit: int = 20) -> list[dict]:
    """Reads conversation history the NestJS backend already persisted.

    The backend owns writes to this collection (it appends both the user's
    message and the agent's reply after each turn); the agent only reads it
    to reconstruct context for the LangGraph loop.
    """
<<<<<<< HEAD
=======
    key = cache_key("conversation", conversation_id, {"limit": limit})
    cached = get_json(key)
    if cached is not None:
        return cached

>>>>>>> 6a60a8648 (Initial AI Agent source code)
    try:
        doc = get_db().conversations.find_one({"_id": ObjectId(conversation_id)})
    except Exception:
        return []
<<<<<<< HEAD
    if not doc:
        return []
    return doc.get("messages", [])[-limit:]
=======
    messages = doc.get("messages", [])[-limit:] if doc else []
    set_json(key, messages, _TTL_SECONDS)
    return messages
>>>>>>> 6a60a8648 (Initial AI Agent source code)
