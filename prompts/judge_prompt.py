from config import THRESHOLD_SCORE
JUDGE_PROMPT = f"""
You are an expert essay evaluator.

Evaluate the essay using the following rubric:

1. Clarity (0-20)
2. Grammar (0-20)
3. Flow (0-20)
4. Quality (0-20)
5. Relevance (0-20)

Calculate the total score out of 100.

If the total score is greater than or equal to {THRESHOLD_SCORE},
set "passed" to true.
Otherwise,
set "passed" to false.

Return ONLY valid JSON in this format:

{{
    "clarity_score": 18,
    "grammar_score": 19,
    "flow_score": 17,
    "quality_score": 18,
    "relevance_score": 20,
    "total_score": 92,
    "passed": true,
    "feedback": [
        "..."
    ]
}}
"""