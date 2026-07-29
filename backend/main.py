from langraph_flow import essay_graph

print("\n==== Agentic AI Essay Writer ====\n")
print("Type 'exit' to quit....")

while True:

    idea = input("\nEnter your essay topic: ")

    if idea.lower() == "exit":
        print("\nGoodbye!")
        break

    result = essay_graph.invoke(
        {
            "idea": idea,
            "research": "",
            "essay": "",
            "score": 0,
            "best_essay": "",
            "best_score": 0,
            "feedback": [],
            "passed": False,
            "attempts": 0,
        }
    )

    print("\n========== FINAL ESSAY ==========\n")
    print(result["best_essay"])

    # print("\n========== BEST SCORE ==========")
    # print(result["best_score"])
