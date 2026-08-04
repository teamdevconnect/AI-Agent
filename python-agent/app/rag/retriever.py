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


def _finance_document_filter(organization_id: str) -> qmodels.Filter:
    # Deliberately org-wide, not per-uploader-private, unlike _document_filter
    # above — vendor invoices are an organizational asset multiple people in
    # one org legitimately need to see. organization_id scoping alone is what
    # makes this safe (real tenant isolation, unlike CRM's "*" bucket), so
    # requiring user_id too would only under-serve the real use case with no
    # security benefit.
    return qmodels.Filter(
        must=[
            qmodels.FieldCondition(key="source_type", match=qmodels.MatchValue(value="finance_document")),
            qmodels.FieldCondition(key="organization_id", match=qmodels.MatchValue(value=organization_id)),
        ]
    )


def retrieve_finance_documents(query: str, organization_id: str, top_k: int = 5) -> list[dict]:
    return hybrid_search.search(query, _finance_document_filter(organization_id), top_k=top_k)


def retrieve_finance_documents_as_context(query: str, organization_id: str, top_k: int = 5) -> str:
    hits = retrieve_finance_documents(query, organization_id, top_k=top_k)
    if not hits:
        return ""
    return "\n\n".join(f"[{h['filename']}] {h['text']}" for h in hits)


def _business_knowledge_filter(organization_id: str) -> qmodels.Filter:
    # Org-wide, not per-uploader-private — same reasoning as
    # _finance_document_filter above: a catalog/SOP/business profile is an
    # organizational asset multiple people in one org legitimately need.
    return qmodels.Filter(
        must=[
            qmodels.FieldCondition(
                key="source_type",
                match=qmodels.MatchAny(any=["business_knowledge_document", "business_profile"]),
            ),
            qmodels.FieldCondition(key="organization_id", match=qmodels.MatchValue(value=organization_id)),
        ]
    )


def retrieve_business_knowledge(query: str, organization_id: str, top_k: int = 5) -> list[dict]:
    return hybrid_search.search(query, _business_knowledge_filter(organization_id), top_k=top_k)


def retrieve_business_knowledge_as_context(query: str, organization_id: str, top_k: int = 5) -> str:
    hits = retrieve_business_knowledge(query, organization_id, top_k=top_k)
    if not hits:
        return ""
    return "\n\n".join(f"[{h['filename']}] {h['text']}" for h in hits)
