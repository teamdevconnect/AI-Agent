from qdrant_client.http import models as qmodels

from app.rag.embeddings import embed_one
from app.rag.vector_store import search

SPEC = {
    "name": "search_business_context",
    "description": (
        "Search indexed CRM records (contacts, deals, notes, accounts, quotes) and the "
        "signed-in user's Outlook mail for context relevant to a question. Use this "
        "proactively for open-ended or personalized questions about clients, deals, "
        "meetings, or correspondence — before or alongside the specific crm_* / "
        "outlook_lookup tools when you need broad context rather than one exact lookup."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "What to search for."},
            "source": {
                "type": "string",
                "enum": ["all", "crm", "outlook"],
                "description": "Restrict results to CRM records, Outlook mail, or both (default all).",
            },
        },
        "required": ["query"],
    },
}

_SOURCE_TYPES = {
    "crm": ["crm_contact", "crm_deal", "crm_note", "crm_account", "crm_quote"],
    "outlook": ["outlook_email"],
}
_SOURCE_TYPES["all"] = _SOURCE_TYPES["crm"] + _SOURCE_TYPES["outlook"]


def run(tool_input: dict, context: dict) -> str:
    query = tool_input.get("query", "")
    if not query:
        return "search_business_context requires a query."

    source = tool_input.get("source", "all")
    if source not in _SOURCE_TYPES:
        source = "all"
    user_id = context.get("user_id", "")

    # CRM records carry user_id="*" (shared, no real owner); Outlook records
    # carry the connected user's real id — this filter always covers both,
    # never omitted, matching the pattern used to fix the document-search
    # tenant-isolation bug in app/rag/retriever.py.
    query_filter = qmodels.Filter(
        must=[
            qmodels.FieldCondition(key="source_type", match=qmodels.MatchAny(any=_SOURCE_TYPES[source])),
            qmodels.FieldCondition(key="user_id", match=qmodels.MatchAny(any=[user_id, "*"])),
        ]
    )

    hits = search(embed_one(query), top_k=8, query_filter=query_filter)
    if not hits:
        return "No relevant CRM or Outlook context found."
    return "\n\n".join(f"[{h.get('source_type')}] {h.get('text', '')}" for h in hits)
