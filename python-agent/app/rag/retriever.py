from qdrant_client.http import models as qmodels

<<<<<<< HEAD
from app.rag.embeddings import embed_one
from app.rag.vector_store import search
=======
from app.rag import hybrid_search
>>>>>>> 6a60a8648 (Initial AI Agent source code)


def _document_filter(user_id: str) -> qmodels.Filter:
    return qmodels.Filter(
        must=[
            qmodels.FieldCondition(key="source_type", match=qmodels.MatchValue(value="document")),
            qmodels.FieldCondition(key="user_id", match=qmodels.MatchValue(value=user_id)),
        ]
    )


def retrieve(query: str, user_id: str, top_k: int = 5) -> list[dict]:
<<<<<<< HEAD
    return search(embed_one(query), top_k=top_k, query_filter=_document_filter(user_id))
=======
    return hybrid_search.search(query, _document_filter(user_id), top_k=top_k)
>>>>>>> 6a60a8648 (Initial AI Agent source code)


def retrieve_as_context(query: str, user_id: str, top_k: int = 5) -> str:
    hits = retrieve(query, user_id, top_k=top_k)
    if not hits:
        return ""
    return "\n\n".join(f"[{h['filename']}] {h['text']}" for h in hits)
