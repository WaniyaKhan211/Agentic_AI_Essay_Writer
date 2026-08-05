from nodes.writer import generate_essay
from nodes.judge import judge_essay
from nodes.research import decide_and_research
from nodes.image_generator import generate_images



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

    result = generate_essay(
        user_idea=state["idea"],
        research=state["research"],
        references=state["references"],
        feedback="\n".join(state["feedback"]),
        previous_essay=state.get("previous_essay", ""),
        conversation_history=state.get("conversation_history", []),
    )

    return {
        "essay": result["markdown"],
        "sections": result["sections"],
    }



def judge_node(state):

    result = judge_essay(state["essay"])

    # print("Score:", result.total_score)
    # print("Passed:", result.passed)
    # print("Feedback:", result.feedback)

    # Keep the best essay
    best_essay = state["best_essay"]
    best_sections = state["best_sections"]
    best_score = state["best_score"]

    if result.total_score > best_score:
        best_score = result.total_score
        best_essay = state["essay"]
        best_sections = state["sections"]

    return {
        "score": result.total_score,
        "passed": result.passed,
        "feedback": result.feedback,
        "attempts": state["attempts"] + 1,
        "best_score": best_score,
        "best_essay": best_essay,
        "best_sections": best_sections,
    }


def image_node(state):

    essay_data = {
        "title": state["idea"],
        "sections": state["best_sections"],
    }

    try:
        images = generate_images(
            topic=state["idea"],
            essay_data=essay_data,
        )
    except Exception as e:
        # Never let an image failure take down the whole essay response.
        print("Image generation failed in image_node:", e)
        images = []

    return {
        "images": images
    }