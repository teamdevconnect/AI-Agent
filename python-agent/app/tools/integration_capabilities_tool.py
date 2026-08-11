from app.integrations import integration_executor

SPEC = {
    "name": "integration_capabilities",
    "description": (
        "List the external integrations connected for this organization, and what resources/actions "
        "are configured for each (e.g. a connected 'gorilladash' integration might expose a 'enquiries' "
        "resource with a 'list' and 'get' endpoint). Call this BEFORE integration_execute to discover "
        "the exact provider/resource_key/endpoint_key to use — do not guess them. Optionally filter to "
        "one provider by name."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "provider": {
                "type": "string",
                "description": "Optional — narrow the listing to one connected integration's provider name.",
            },
        },
    },
}


def run(tool_input: dict, context: dict) -> str:
    organization_id = context.get("organization_id")
    if not organization_id:
        return "No organization context available."

    try:
        capabilities = integration_executor.get_capabilities(
            organization_id, context.get("user_id", ""), tool_input.get("provider")
        )
    except Exception as exc:
        return f"Failed to list integration capabilities: {exc}"

    if not capabilities:
        return (
            "No connected integrations have any resources/endpoints configured yet. "
            "Ask the user to connect one and configure at least one resource/endpoint via the Integrations page."
        )

    lines = []
    for entry in capabilities:
        lines.append(f"Provider: {entry['provider']}")
        for resource in entry["resources"]:
            lines.append(f"  Resource '{resource['key']}' ({resource['name']})")
            for ep in resource["endpoints"]:
                desc = f" — {ep['description']}" if ep.get("description") else ""
                lines.append(f"    - endpoint_key='{ep['key']}': {ep['method']} {ep['path']}{desc}")
    return "\n".join(lines)
