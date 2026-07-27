from nodes.writer import generate_essay
from nodes.judge import judge_essay
from nodes.research import decide_and_research



def research_node(state):

    print("\n========== RESEARCH NODE ==========")
    print("Topic:", state["idea"])

    research = decide_and_research(
        state["idea"]
    )

    return {
        "research": research
    }



def writer_node(state):

    print("\n========== WRITER NODE ==========")
    print("Attempt:", state["attempts"] + 1)
    print("Feedback used:", state["feedback"])

    essay = generate_essay(
        user_idea=state["idea"],
        research=state["research"],
        feedback="\n".join(state["feedback"])
    )

    return {
        "essay": essay
    }



def judge_node(state):

    print("\n========== JUDGE NODE ==========")

    result = judge_essay(
        state["essay"]
    )

    print("Score:", result.total_score)
    print("Passed:", result.passed)
    print("Feedback:", result.feedback)

    return {
        "score": result.total_score,
        "passed": result.passed,
        "feedback": result.feedback,
        "attempts": state["attempts"] + 1
    }