from typing import TypedDict, List


class EssayState(TypedDict):

    idea: str
    research: str
    references: List[dict]
    essay: str
    sections: List[dict]
    score: int
    best_essay: str
    best_sections: List[dict]
    best_score: int
    feedback: List[str]
    passed: bool
    attempts: int
    is_valid: bool
    response: str
    images: List[dict]
    previous_essay: str
    is_followup: bool