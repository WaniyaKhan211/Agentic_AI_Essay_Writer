from pydantic import BaseModel, Field
from typing import List


class JudgeResult(BaseModel):
    clarity_score: int = Field(ge=0, le=20)
    grammar_score: int = Field(ge=0, le=20)
    flow_score: int = Field(ge=0, le=20)
    quality_score: int = Field(ge=0, le=20)
    relevance_score: int = Field(ge=0, le=20)

    total_score: int = Field(ge=0, le=100)

    passed: bool
    
    feedback: List[str]