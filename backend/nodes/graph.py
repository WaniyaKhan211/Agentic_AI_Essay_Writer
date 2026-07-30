from nodes.writer import generate_essay
from nodes.judge import judge_essay
from nodes.research import decide_and_research



def research_node(state):

    print("Topic:", state["idea"])

    data = decide_and_research(state["idea"])

    return {
        "research": data["research"],
        "references": data["references"]
    }

def writer_node(state):

    # print("Attempt:", state["attempts"] + 1)
    # print("Feedback used:", state["feedback"])

    essay = generate_essay(
        user_idea=state["idea"],
        research=state["research"],
        references=state["references"],
        feedback="\n".join(state["feedback"])
    )

    return {
        "essay": essay
    }



def judge_node(state):

    result = judge_essay(state["essay"])

    # print("Score:", result.total_score)
    # print("Passed:", result.passed)
    # print("Feedback:", result.feedback)

    # Keep the best essay
    best_essay = state["best_essay"]
    best_score = state["best_score"]

    if result.total_score > best_score:
        best_score = result.total_score
        best_essay = state["essay"]

    return {
        "score": result.total_score,
        "passed": result.passed,
        "feedback": result.feedback,
        "attempts": state["attempts"] + 1,
        "best_score": best_score,
        "best_essay": best_essay,
    }