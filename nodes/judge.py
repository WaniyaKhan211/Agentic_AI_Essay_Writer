import json

from langchain_groq import ChatGroq

from config import (
    GROQ_API_KEY,
    GROQ_MODEL,
    TEMPERATURE,
)

from prompts.judge_prompt import JUDGE_PROMPT
from schemas.judge_schema import JudgeResult


llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model=GROQ_MODEL,
    temperature=TEMPERATURE,
)


def judge_essay(essay: str):

    prompt = f"""
{JUDGE_PROMPT}

Essay:

{essay}

Return only JSON.
"""

    response = llm.invoke(prompt)

    json_result = json.loads(response.content)

    result = JudgeResult(**json_result)

    print("\n========== PYDANTIC OUTPUT ==========")
    print(result)

    return result