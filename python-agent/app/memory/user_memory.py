"""Long-term memory: durable per-user facts/preferences the agent decides are
worth keeping across conversations (see app.tools.memory_tool).

Mongo is the system of record (python-agent owns writes here, unlike
conversation_store.py's read-only relationship to the backend-owned
"conversations" collection). Every write is also embedded into the existing
Qdrant collection under source_type="memory" (app.rag.vector_store), which is
what makes these semantically searchable via search_business_context — long-term
and semantic memory share one write path so they can never drift apart.
"""

from datetime import datetime, timezone

from bson import ObjectId
from qdrant_client.http import models as qmodels

from app.memory.mongo_client import get_db
from app.rag import embeddings, vector_store


def save_memory(user_id: str, text: str, memory_type: str = "fact") -> str:
    doc = {
        "userId": user_id,
        "type": memory_type,
        "text": text,
        "createdAt": datetime.now(timezone.utc),
    }
    inserted_id = get_db().agent_memories.insert_one(doc).inserted_id

    point = qmodels.PointStruct(
        id=vector_store.memory_point_id(str(inserted_id)),
        vector=embeddings.embed_one(text),
        payload={
            "source_type": "memory",
            "user_id": user_id,
            "record_id": str(inserted_id),
            "memory_type": memory_type,
            "text": text,
        },
    )
    vector_store.upsert_points([point])
    return str(inserted_id)


def list_memories(user_id: str, limit: int = 50) -> list[dict]:
    cursor = get_db().agent_memories.find({"userId": user_id}).sort("createdAt", -1).limit(limit)
    return [{**doc, "_id": str(doc["_id"])} for doc in cursor]


def delete_memory(user_id: str, memory_id: str) -> None:
    get_db().agent_memories.delete_one({"_id": ObjectId(memory_id), "userId": user_id})
    vector_store.delete_by_record_id("memory", memory_id)
