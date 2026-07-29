from langgraph.graph import StateGraph, END

from schemas.state_schema import EssayState

from nodes.graph import (
    research_node,
    writer_node,
    judge_node
)



def check_score(state):

    if state["passed"]:
        return "end"

    if state["attempts"] >= 3:
        return "end"

    return "retry"



graph = StateGraph(EssayState)


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



graph.set_entry_point(
    "research"
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
        "end": END
    }
)

essay_graph = graph.compile()
