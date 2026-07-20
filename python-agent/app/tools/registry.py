from app.tools import (
    business_search_tool,
    calendar_tool,
    crm_account_tool,
    crm_deal_tool,
    crm_note_tool,
    crm_product_tool,
    crm_quote_tool,
    crm_tag_tool,
    crm_tool,
    database_tool,
    document_tool,
    email_tool,
    employee_tool,
    outlook_tool,
    search_tool,
    whatsapp_tool,
)

_MODULES = [
    crm_tool,
    crm_deal_tool,
    crm_note_tool,
    crm_tag_tool,
    crm_account_tool,
    crm_product_tool,
    crm_quote_tool,
    outlook_tool,
    whatsapp_tool,
    calendar_tool,
    employee_tool,
    database_tool,
    search_tool,
    email_tool,
    document_tool,
    business_search_tool,
]

TOOL_DEFINITIONS = [m.SPEC for m in _MODULES]
_HANDLERS = {m.SPEC["name"]: m.run for m in _MODULES}


def execute_tool(name: str, tool_input: dict, context: dict) -> str:
    handler = _HANDLERS.get(name)
    if handler is None:
        return f"Unknown tool: {name}"
    try:
        return handler(tool_input, context)
    except Exception as exc:  # tool failures become context for Claude, not crashes
        return f"Tool '{name}' failed: {exc}"
