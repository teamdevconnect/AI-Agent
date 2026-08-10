from app.integrations import integration_executor

SPEC = {
    "name": "integration_execute",
    "description": (
        "Execute one configured action against a connected external integration (any CRM/SaaS the org has "
        "connected via the Integrations page — e.g. Salesforce, HubSpot, or a custom-connected REST API). "
        "Call integration_capabilities first to find the exact provider, resource_key, and endpoint_key — "
        "this tool does not guess them. path_params fills {token} placeholders in the endpoint's URL "
        "template (e.g. {\"id\": \"123\"} for a path like /leads/{id}); query adds query-string parameters; "
        "body is the JSON request body for POST/PUT/PATCH endpoints."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "provider": {"type": "string", "description": "The connected integration's provider name."},
            "resource_key": {"type": "string", "description": "The resource key from integration_capabilities."},
            "endpoint_key": {"type": "string", "description": "The endpoint key from integration_capabilities."},
            "path_params": {"type": "object", "description": "Values for {token} placeholders in the endpoint path."},
            "query": {"type": "object", "description": "Query-string parameters."},
            "body": {"description": "Request body for POST/PUT/PATCH endpoints."},
        },
        "required": ["provider", "resource_key", "endpoint_key"],
    },
}


def run(tool_input: dict, context: dict) -> str:
    organization_id = context.get("organization_id")
    if not organization_id:
        return "No organization context available."

    try:
        result = integration_executor.execute(
            organization_id,
            tool_input["provider"],
            tool_input["resource_key"],
            tool_input["endpoint_key"],
            user_id=context.get("user_id", ""),
            path_params=tool_input.get("path_params"),
            query=tool_input.get("query"),
            body=tool_input.get("body"),
        )
    except Exception as exc:
        return f"integration_execute failed: {exc}"

    if not result.get("success"):
        return f"Request failed: {result.get('message', 'unknown error')}"

    data = result.get("data")
    return f"{result.get('message', 'Success')}\n{data}"
