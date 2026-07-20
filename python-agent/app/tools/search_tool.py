from app.config import settings

SPEC = {
    "name": "web_search",
    "description": "Search the public web for up-to-date information not found in internal documents.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query."},
        },
        "required": ["query"],
    },
}


def run(tool_input: dict, context: dict) -> str:
    query = tool_input.get("query", "")

    if not settings.search_api_key:
        # Stub: plug in a real search API (Tavily, Bing Web Search, SerpAPI, ...)
        # using settings.search_api_key once available.
        return f"Web search is not configured. Cannot search for: '{query}'."

    return f"Web search configured but not yet implemented for query: '{query}'."
