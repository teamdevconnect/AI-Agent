from qdrant_client.http import models as qmodels

<<<<<<< HEAD
from app.rag.embeddings import embed_one
from app.rag.vector_store import search
=======
from app.rag import compression, hybrid_search
>>>>>>> 6a60a8648 (Initial AI Agent source code)

SPEC = {
    "name": "search_business_context",
    "description": (
<<<<<<< HEAD
        "Search indexed CRM records (contacts, deals, notes, accounts, quotes) and the "
        "signed-in user's Outlook mail for context relevant to a question. Use this "
        "proactively for open-ended or personalized questions about clients, deals, "
        "meetings, or correspondence — before or alongside the specific crm_* / "
        "outlook_lookup tools when you need broad context rather than one exact lookup."
=======
        "Search indexed CRM records (contacts, deals, notes, accounts, quotes), the "
        "signed-in user's Outlook mail, shared business documents (SOPs, policies, role "
        "definitions), and previously saved long-term memories (facts/preferences saved via "
        "the remember tool) for context relevant to a question. Use this proactively for "
        "open-ended or personalized questions about clients, deals, meetings, "
        "correspondence, company procedures, or the user's known preferences — before or "
        "alongside the specific crm_* / outlook_lookup tools when you need broad context "
        "rather than one exact lookup."
>>>>>>> 6a60a8648 (Initial AI Agent source code)
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "What to search for."},
            "source": {
                "type": "string",
<<<<<<< HEAD
                "enum": ["all", "crm", "outlook"],
                "description": "Restrict results to CRM records, Outlook mail, or both (default all).",
=======
                "enum": ["all", "crm", "outlook", "document", "memory"],
                "description": "Restrict results to CRM records, Outlook mail, shared documents, saved memories, or all (default all).",
>>>>>>> 6a60a8648 (Initial AI Agent source code)
            },
        },
        "required": ["query"],
    },
}

_SOURCE_TYPES = {
    "crm": ["crm_contact", "crm_deal", "crm_note", "crm_account", "crm_quote"],
    "outlook": ["outlook_email"],
<<<<<<< HEAD
}
_SOURCE_TYPES["all"] = _SOURCE_TYPES["crm"] + _SOURCE_TYPES["outlook"]
=======
    "document": ["document"],  # role-source SOPs (user_id="*") and other shared uploads
    "memory": ["memory"],  # long-term facts/preferences saved via the remember tool
}
_SOURCE_TYPES["all"] = _SOURCE_TYPES["crm"] + _SOURCE_TYPES["outlook"] + _SOURCE_TYPES["document"] + _SOURCE_TYPES["memory"]
>>>>>>> 6a60a8648 (Initial AI Agent source code)


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

<<<<<<< HEAD
    hits = search(embed_one(query), top_k=8, query_filter=query_filter)
    if not hits:
        return "No relevant CRM or Outlook context found."
    return "\n\n".join(f"[{h.get('source_type')}] {h.get('text', '')}" for h in hits)
=======
    hits = hybrid_search.search(query, query_filter, top_k=8)
    if not hits:
        return "No relevant CRM or Outlook context found."

    # [n] markers are a citation convention (see app.agent.llm_client's
    # SYSTEM_PROMPT) — the model is instructed to keep them next to the
    # claims they support in its final answer.
    lines = [
        f"[{i}] ({h.get('source_type')}) {compression.compress(query, h.get('text', ''))}"
        for i, h in enumerate(hits, start=1)
    ]
    return "\n\n".join(lines)
>>>>>>> 6a60a8648 (Initial AI Agent source code)
