from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import InMemorySaver

from schemas.state_schema import EssayState

from nodes.graph import (
    research_node,
    writer_node,
    judge_node,
    image_node
)

from nodes.validator import validator_node

def route_entry(state):
    if state.get("is_followup") and state.get("previous_essay"):
        return "writer"

    return "validator"

    
def check_request(state):

    if state["is_valid"]:
        return "essay"

    return "invalid"


def check_score(state):

    if state["passed"] or state["attempts"] >= 3:
        return "end"

    return "retry"


graph = StateGraph(EssayState)


graph.add_node(
    "validator",
    validator_node
)

graph.add_node(
    "research",
    research_node
)

graph.add_node(
    "writer",
    writer_node
)

graph.add_node(
    "judge",
    judge_node
)

graph.add_node(
    "images",
    image_node
)

graph.set_conditional_entry_point(
    route_entry,
    {
        "validator": "validator",
        "writer": "writer"
    },
)

graph.add_conditional_edges(
    "validator",
    check_request,
    {
        "essay": "research",
        "invalid": END
    }
)


graph.add_edge(
    "research",
    "writer"
)


graph.add_edge(
    "writer",
    "judge"
)


graph.add_conditional_edges(
    "judge",
    check_score,
    {
        "retry": "writer",
        "end": "images"
    }
)



graph.add_edge(
    "images",
    END
)

memory = InMemorySaver()
essay_graph = graph.compile(checkpointer=memory)
