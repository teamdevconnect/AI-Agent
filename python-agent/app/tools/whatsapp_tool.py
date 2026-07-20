import requests

from app.config import settings

SPEC = {
    "name": "send_whatsapp_message",
    "description": "Send a WhatsApp message to a phone number via the Meta Cloud API.",
    "input_schema": {
        "type": "object",
        "properties": {
            "to": {"type": "string", "description": "Recipient phone number, E.164 format."},
            "message": {"type": "string", "description": "Message body to send."},
        },
        "required": ["to", "message"],
    },
}


def run(tool_input: dict, context: dict) -> str:
    to = tool_input.get("to", "")
    message = tool_input.get("message", "")

    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        return f"Stub: would send WhatsApp message to {to}: '{message}'."

    url = f"https://graph.facebook.com/v20.0/{settings.whatsapp_phone_number_id}/messages"
    headers = {"Authorization": f"Bearer {settings.whatsapp_access_token}"}
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": message},
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        return f"WhatsApp message sent to {to}."
    except requests.RequestException as exc:
        return f"Failed to send WhatsApp message: {exc}"
