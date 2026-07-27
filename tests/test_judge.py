from nodes.judge import judge_essay

essay = """
Artificial Intelligence is transforming education by personalizing learning,
automating grading, and providing intelligent tutoring systems.
These technologies improve learning outcomes while supporting teachers.
"""

result = judge_essay(essay)

print(result.total_score)

print(result.feedback)

print(result.passed)