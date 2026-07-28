"""MCP (Model Context Protocol) server exposing this agent's tool registry
to external MCP clients (Claude Desktop, other agents, IDEs) — a standard,
interoperable surface on top of the exact same app.tools.registry.execute_tool
the live chat loop uses, with the same validation/rate-limit/permission
hardening applied uniformly (see execute_tool's docstring).

Mounted onto the main FastAPI app at /mcp (see app.main) rather than run as a
separate process, so it shares this app's config, credentials, and Mongo/
Qdrant connections with no extra deployment.

Gated by the same backend-issued JWT every other route requires (see
app.security.get_current_user) — these tools reach real CRM/Outlook/business
data, so an unauthenticated MCP client must never reach them. Unlike a normal
FastAPI route, MCP's low-level Server has no per-call request object to pull
a Depends() from, so the authenticated user_id is captured once per SSE
connection (_handle_sse) into a contextvar and read back in _call_tool —
this is what makes execute_tool's user_id trustworthy here rather than a
client-supplied argument, which any caller could spoof to impersonate
another user's Outlook mailbox or notes.

Known limitation: MCP callers all get the *authenticated user's* identity,
not the fine-grained per-specialist tool scoping live chat gets from
app.agent.specialists — allowed_tools is left unrestricted (None) below.
Closing that gap would mean either per-connection tool scoping (not
supported by this MCP SDK version's Server API) or a second, restricted MCP
endpoint — not done here; flagged for later if this is opened up to
lower-trust external clients.
"""

import contextvars

import jwt
import mcp.types as types
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.responses import Response
from starlette.routing import Mount, Route

from app.config import settings
from app.tools.registry import TOOL_DEFINITIONS, execute_tool

_server = Server("franchise-ai-agent")
_current_user_id: contextvars.ContextVar[str] = contextvars.ContextVar("mcp_user_id", default="*")


@_server.list_tools()
async def _list_tools() -> list[types.Tool]:
    return [
        types.Tool(name=spec["name"], description=spec["description"], inputSchema=spec["input_schema"])
        for spec in TOOL_DEFINITIONS
    ]


@_server.call_tool()
async def _call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    context = {"user_id": _current_user_id.get(), "conversation_id": "mcp"}
    result = execute_tool(name, arguments, context)
    return [types.TextContent(type="text", text=result)]


def _verify_jwt(request) -> dict | None:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    try:
        return jwt.decode(header[7:], settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


_sse = SseServerTransport("/messages/")


async def _handle_sse(request):
    payload = _verify_jwt(request)
    if payload is None or "sub" not in payload:
        return Response(status_code=401)

    token = _current_user_id.set(payload["sub"])
    try:
        async with _sse.connect_sse(request.scope, request.receive, request._send) as (read_stream, write_stream):
            await _server.run(read_stream, write_stream, _server.create_initialization_options())
    finally:
        _current_user_id.reset(token)
    return Response()


app = Starlette(
    routes=[
        Route("/sse", endpoint=_handle_sse),
        Mount("/messages/", app=_sse.handle_post_message),
    ]
)
