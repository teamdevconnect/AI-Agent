import json
from concurrent.futures import ThreadPoolExecutor

from langgraph.graph import END, START, StateGraph

from app.agent.llm_client import call_llm
from app.agent.router import choose_provider
from app.agent.state import AgentState
from app.tools.registry import execute_tool

MAX_TOOL_ROUNDS = 5


def planner_node(state: AgentState) -> dict:
    provider = state.get("provider") or choose_provider(state)
    output_items, used_provider = call_llm(state["messages"], provider=provider)
    pending_calls = [item for item in output_items if item.get("type") == "function_call"]
    return {"messages": output_items, "pending_calls": pending_calls, "provider": used_provider}


def tools_node(state: AgentState) -> dict:
    context = {"user_id": state["user_id"], "conversation_id": state["conversation_id"]}
    pending_calls = state["pending_calls"]

    def run_call(call: dict) -> str:
        args = json.loads(call.get("arguments") or "{}")
        return execute_tool(call["name"], args, context)

    # Claude often requests several independent lookups in one turn (e.g. one
    # crm_note call per contact) — those are I/O-bound HTTP calls with no
    # dependency on each other, so run them concurrently instead of one at a
    # time. executor.map preserves input order, so zip pairs each call with
    # its own result correctly.
    with ThreadPoolExecutor(max_workers=min(len(pending_calls), 8) or 1) as executor:
        results = list(executor.map(run_call, pending_calls))

    tools_used = [call["name"] for call in pending_calls]
    result_items = [
        {"type": "function_call_output", "call_id": call["call_id"], "output": result}
        for call, result in zip(pending_calls, results)
    ]

    return {
        "messages": result_items,
        "pending_calls": [],
        "tools_used": tools_used,
        "rounds": state.get("rounds", 0) + 1,
    }


def should_continue(state: AgentState) -> str:
    if state["pending_calls"] and state.get("rounds", 0) < MAX_TOOL_ROUNDS:
        return "tools"
    return END


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("planner", planner_node)
    graph.add_node("tools", tools_node)
    graph.add_edge(START, "planner")
    graph.add_conditional_edges("planner", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "planner")
    return graph.compile()


_compiled_graph = None


def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph


def final_text(state: dict) -> str:
    for item in reversed(state["messages"]):
        if item.get("type") == "message" and item.get("role") == "assistant":
            return "\n".join(
                c.get("text", "") for c in item.get("content", []) if c.get("type") == "output_text"
            )
    return ""
