from langraph_flow import essay_graph

idea = input("Enter your essay topic: ")

result = essay_graph.invoke(
    {
        "idea":idea,
        "research":"",
        "essay":"",
        "score":0,
        "feedback":[],
        "passed":False,
        "attempts":0
    }
)

print("\nFINAL ESSAY\n")
print(result["essay"])

print("\nSCORE:")
print(result["score"])