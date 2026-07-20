import operator
from typing import Annotated, TypedDict


class AgentState(TypedDict):
    messages: Annotated[list[dict], operator.add]
    pending_calls: list[dict]
    tools_used: Annotated[list[str], operator.add]
    rounds: int
    provider: str
    user_id: str
    conversation_id: str
