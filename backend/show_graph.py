from langraph_flow import essay_graph

graph = essay_graph.get_graph(xray=True)

png = graph.draw_mermaid_png()

with open("essay_graph.png", "wb") as f:
    f.write(png)

print("Graph saved as essay_graph.png")