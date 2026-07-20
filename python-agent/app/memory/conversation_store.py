from bson import ObjectId

from app.memory.mongo_client import get_db


def get_recent_messages(conversation_id: str, limit: int = 20) -> list[dict]:
    """Reads conversation history the NestJS backend already persisted.

    The backend owns writes to this collection (it appends both the user's
    message and the agent's reply after each turn); the agent only reads it
    to reconstruct context for the LangGraph loop.
    """
    try:
        doc = get_db().conversations.find_one({"_id": ObjectId(conversation_id)})
    except Exception:
        return []
    if not doc:
        return []
    return doc.get("messages", [])[-limit:]
