from app.memory import user_memory

SPEC = {
    "name": "remember",
    "description": (
        "Save a durable fact or preference about this user or their business so it's "
        "available in future conversations — e.g. a stated preference ('always send "
        "quotes as PDF'), a recurring detail ('this store closes early on Sundays'), or "
        "anything explicitly worth remembering long-term. Not for information already "
        "retrievable from CRM, Outlook, or documents — only for things that would "
        "otherwise be lost once this conversation ends."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "The fact or preference to remember, written so it stands alone without this conversation's context."},
            "type": {
                "type": "string",
                "enum": ["preference", "fact", "episodic"],
                "description": "'preference' for stated preferences, 'fact' for durable business/user facts, 'episodic' for a notable past event or decision.",
            },
        },
        "required": ["text"],
    },
}


def run(tool_input: dict, context: dict) -> str:
    text = tool_input.get("text", "").strip()
    if not text:
        return "remember requires non-empty text."
    memory_id = user_memory.save_memory(context["user_id"], text, tool_input.get("type", "fact"))
    return f"Saved to long-term memory (id={memory_id})."
