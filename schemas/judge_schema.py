from pydantic import BaseModel
from typing import List


class JudgeResult(BaseModel):
    clarity_score: int
    grammar_score: int
    flow_score: int
    quality_score: int
    relevance_score: int

    total_score: int

    passed: bool

    feedback: List[str]