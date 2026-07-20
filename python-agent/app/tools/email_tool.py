import smtplib
from email.mime.text import MIMEText

from app.config import settings

SPEC = {
    "name": "send_email",
    "description": "Send an email via SMTP.",
    "input_schema": {
        "type": "object",
        "properties": {
            "to": {"type": "string", "description": "Recipient email address."},
            "subject": {"type": "string"},
            "body": {"type": "string"},
        },
        "required": ["to", "subject", "body"],
    },
}


def run(tool_input: dict, context: dict) -> str:
    to = tool_input.get("to", "")
    subject = tool_input.get("subject", "")
    body = tool_input.get("body", "")

    if not settings.smtp_host:
        return f"Stub: would email {to} with subject '{subject}'."

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.smtp_user
    msg["To"] = to

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return f"Email sent to {to}."
    except (smtplib.SMTPException, OSError) as exc:
        return f"Failed to send email: {exc}"
