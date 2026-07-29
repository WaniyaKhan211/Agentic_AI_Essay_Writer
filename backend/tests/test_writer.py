from nodes.writer import generate_essay


essay = generate_essay(
    user_idea="Artificial Intelligence in Education",
    research="""
Artificial intelligence personalizes learning,
provides intelligent tutoring,
automates grading,
and improves student engagement.
""",
    feedback=""
)

print(essay)