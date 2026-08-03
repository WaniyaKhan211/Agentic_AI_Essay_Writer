import uuid
from langraph_flow import essay_graph

print("\n==== Agentic AI Essay Writer ====\n")
print("Type 'exit' to quit....")

thread_id = str(uuid.uuid4())
config = {"configurable": {"thread_id": thread_id}}

while True:

    idea = input("\nEnter your essay topic: ")

    if idea.lower() == "exit":
        print("\nGoodbye!")
        break

    snapshot = essay_graph.get_state(config)
    prior_values = snapshot.values if snapshot else {}
    previous_essay = prior_values.get("best_essay", "")
    is_followup = bool(previous_essay)

    result = essay_graph.invoke(
        {
            "idea": idea,
            "research": "" if not is_followup else prior_values.get("research", ""),
            "references": [] if not is_followup else prior_values.get("references", []),
            "essay": "",
            "score": 0,
            "best_essay": "",
            "best_score": 0,
            "feedback": [],
            "passed": False,
            "attempts": 0,
            "is_valid": True,
            "response": "",
            "is_followup": is_followup,
            "previous_essay": previous_essay,
        },
        config=config,
    )

    if not result["is_valid"]:
        print("\n========== RESPONSE ==========\n")
        print(result["response"])
    else:
        print("\n========== FINAL ESSAY ==========\n")
        print(result["best_essay"])

        # print("\n========== BEST SCORE ==========")
        # print(result["best_score"])