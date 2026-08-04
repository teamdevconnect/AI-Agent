from qdrant_client.http import models as qmodels

from app.rag import compression, hybrid_search

SPEC = {
    "name": "search_business_context",
    "description": (
        "Search indexed CRM records (contacts, deals, notes, accounts, quotes), the "
        "signed-in user's Outlook mail, shared business documents (SOPs, policies, role "
        "definitions), the organization's business profile and knowledge documents "
        "(catalogs, price lists, brand/marketing materials, internal manuals), and "
        "previously saved long-term memories (facts/preferences saved via the remember "
        "tool) for context relevant to a question. Use this proactively for open-ended or "
        "personalized questions about clients, deals, meetings, correspondence, company "
        "procedures, products/pricing, or the user's known preferences — before or "
        "alongside the specific crm_* / outlook_lookup tools when you need broad context "
        "rather than one exact lookup."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "What to search for."},
            "source": {
                "type": "string",
                "enum": ["all", "crm", "outlook", "document", "memory", "business_knowledge"],
                "description": (
                    "Restrict results to CRM records, Outlook mail, shared documents, saved "
                    "memories, the organization's business profile/knowledge documents, or all "
                    "(default all)."
                ),
            },
        },
        "required": ["query"],
    },
}

_SOURCE_TYPES = {
    "crm": ["crm_contact", "crm_deal", "crm_note", "crm_account", "crm_quote"],
    "outlook": ["outlook_email"],
    "document": ["document"],  # role-source SOPs (user_id="*") and other shared uploads
    "memory": ["memory"],  # long-term facts/preferences saved via the remember tool
    "business_knowledge": ["business_knowledge_document", "business_profile"],
}
_SOURCE_TYPES["all"] = (
    _SOURCE_TYPES["crm"]
    + _SOURCE_TYPES["outlook"]
    + _SOURCE_TYPES["document"]
    + _SOURCE_TYPES["memory"]
    + _SOURCE_TYPES["business_knowledge"]
)

# Points for these source types carry a real organization_id payload field
# and must be scoped by it (a catalog/profile is an organizational asset,
# not private to its uploader — see app.rag.retriever._business_knowledge_filter).
# Every other source type here (crm/outlook/document/memory) has no
# organization_id field at all, so an org-scoped clause on them would zero
# out results that are correctly scoped by user_id alone today.
_ORG_SCOPED_TYPES = set(_SOURCE_TYPES["business_knowledge"])


def run(tool_input: dict, context: dict) -> str:
    query = tool_input.get("query", "")
    if not query:
        return "search_business_context requires a query."

    source = tool_input.get("source", "all")
    if source not in _SOURCE_TYPES:
        source = "all"
    user_id = context.get("user_id", "")
    organization_id = context.get("organization_id")

    requested = _SOURCE_TYPES[source]
    scoped = [t for t in requested if t in _ORG_SCOPED_TYPES]
    unscoped = [t for t in requested if t not in _ORG_SCOPED_TYPES]

    # CRM records carry user_id="*" (shared, no real owner); Outlook records
    # carry the connected user's real id — this branch always covers both,
    # never omitted, matching the pattern used to fix the document-search
    # tenant-isolation bug in app/rag/retriever.py. business_knowledge_*
    # points instead get a separate, organization_id-scoped branch (never a
    # flat combined filter — these points have no user_id-based ownership
    # concept, and adding an org clause to the branch above would silently
    # zero out every other source, none of which carry organization_id).
    branches = []
    if unscoped:
        branches.append(
            qmodels.Filter(
                must=[
                    qmodels.FieldCondition(key="source_type", match=qmodels.MatchAny(any=unscoped)),
                    qmodels.FieldCondition(key="user_id", match=qmodels.MatchAny(any=[user_id, "*"])),
                ]
            )
        )
    if scoped and organization_id:
        branches.append(
            qmodels.Filter(
                must=[
                    qmodels.FieldCondition(key="source_type", match=qmodels.MatchAny(any=scoped)),
                    qmodels.FieldCondition(key="organization_id", match=qmodels.MatchValue(value=organization_id)),
                ]
            )
        )

    if not branches:
        return "No relevant CRM or Outlook context found."
    query_filter = branches[0] if len(branches) == 1 else qmodels.Filter(should=branches)

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
