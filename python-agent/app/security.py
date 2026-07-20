import jwt
from fastapi import HTTPException, Request, status

from app.config import settings


def get_current_user(request: Request) -> dict:
    """Re-validates the JWT the backend already checked and forwarded.

    The agent is never openly callable: every route depends on this so a
    request without a valid backend-issued token is rejected here too.
    """
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = header[7:]
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc

    if "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token payload")
    return payload
