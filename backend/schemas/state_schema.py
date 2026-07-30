from typing import TypedDict, List


class EssayState(TypedDict):

    idea: str
    research: str
    references: List[dict]
    essay: str
    score: int
    best_essay: str
    best_score: int
    feedback: List[str]
    passed: bool
    attempts: int
    is_valid: bool
    response: str