import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def graph_get(path: str, access_token: str, params: dict | None = None) -> dict:
    response = requests.get(
        f"{GRAPH_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def graph_post(path: str, access_token: str, json_body: dict) -> dict:
    response = requests.post(
        f"{GRAPH_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        json=json_body,
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def list_recent_messages(access_token: str, top: int = 50) -> list[dict]:
    """Recent inbox messages for the RAG business sync job — includes `id`
    (needed for a deterministic Qdrant point id) alongside the fields
    outlook_tool.py already selects for on-demand chat lookups."""
    data = graph_get(
        "/me/messages",
        access_token,
        params={
            "$top": top,
            "$orderby": "receivedDateTime desc",
            "$select": "id,subject,from,receivedDateTime,bodyPreview",
        },
    )
    return data.get("value", [])
