from nodes.research import decide_and_research

# Should likely trigger search (needs current info)
print(decide_and_research("Impact of the 2025 AI regulation policies on startups"))

print("\n---\n")

# Should likely NOT trigger search (timeless/general topic)
print(decide_and_research("The importance of honesty in personal relationships"))