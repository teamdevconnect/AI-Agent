from app.rag import compression
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

    # [n] markers are a citation convention (see app.agent.llm_client's
    # SYSTEM_PROMPT) — the model is instructed to keep them next to the
    # claims they support in its final answer.
    lines = [
        f"[{i}] ({h.get('filename')}) {compression.compress(query, h.get('text', ''))}"
        for i, h in enumerate(hits, start=1)
    ]
    return "\n\n".join(lines)
