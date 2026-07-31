from qdrant_client.http import models as qmodels

from app.rag import hybrid_search


def _document_filter(user_id: str) -> qmodels.Filter:
    return qmodels.Filter(
        must=[
            qmodels.FieldCondition(key="source_type", match=qmodels.MatchValue(value="document")),
            qmodels.FieldCondition(key="user_id", match=qmodels.MatchValue(value=user_id)),
        ]
    )


def retrieve(query: str, user_id: str, top_k: int = 5) -> list[dict]:
    return hybrid_search.search(query, _document_filter(user_id), top_k=top_k)


def retrieve_as_context(query: str, user_id: str, top_k: int = 5) -> str:
    hits = retrieve(query, user_id, top_k=top_k)
    if not hits:
        return ""
    return "\n\n".join(f"[{h['filename']}] {h['text']}" for h in hits)
