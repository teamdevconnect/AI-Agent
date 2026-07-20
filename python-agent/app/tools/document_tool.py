from app.rag.retriever import retrieve

SPEC = {
    "name": "search_documents",
    "description": (
        "Search the user's uploaded documents (PDFs, Word, Excel, web pages) "
        "for passages relevant to a question."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "What to search for."},
        },
        "required": ["query"],
    },
}


def run(tool_input: dict, context: dict) -> str:
    query = tool_input.get("query", "")
    hits = retrieve(query, user_id=context.get("user_id", ""), top_k=5)
    if not hits:
        return "No relevant documents found."
    return "\n\n".join(f"[{h['filename']}] {h['text']}" for h in hits)
