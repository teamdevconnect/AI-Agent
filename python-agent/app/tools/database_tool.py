from bson import ObjectId
from bson.errors import InvalidId

from app.memory.mongo_client import get_db

SPEC = {
    "name": "query_database",
    "description": "Read the current user's saved notes or stored preferences from the database.",
    "input_schema": {
        "type": "object",
        "properties": {
            "resource": {"type": "string", "enum": ["notes", "preferences"]},
        },
        "required": ["resource"],
    },
}


def run(tool_input: dict, context: dict) -> str:
    resource = tool_input.get("resource", "notes")
    user_id = context.get("user_id", "")
    db = get_db()

    if resource == "notes":
        notes = list(db.notes.find({"user_id": user_id}).sort("created_at", -1).limit(20))
        if not notes:
            return "No saved notes found."
        return "\n".join(f"- {n.get('text', '')}" for n in notes)

    try:
        user = db.users.find_one({"_id": ObjectId(user_id)}, {"preferences": 1})
    except InvalidId:
        return "No preferences found."
    if not user:
        return "No preferences found."
    return str(user.get("preferences", {}))
