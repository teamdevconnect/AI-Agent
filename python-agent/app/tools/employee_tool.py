SPEC = {
    "name": "employee_lookup",
    "description": "Look up employee directory information (role, team, manager).",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Name or team to search for."},
        },
        "required": ["query"],
    },
}

# Stub: replace with a real HRIS/directory lookup (Workday, BambooHR, Azure AD, ...).
_DIRECTORY = [
    {"name": "Jane Doe", "role": "Sales Manager", "team": "Sales", "manager": "VP Sales"},
    {"name": "John Smith", "role": "Account Executive", "team": "Sales", "manager": "Jane Doe"},
]


def run(tool_input: dict, context: dict) -> str:
    query = tool_input.get("query", "").lower()
    matches = [
        e for e in _DIRECTORY if query in e["name"].lower() or query in e["team"].lower()
    ]
    return str(matches) if matches else "No matching employees found."
