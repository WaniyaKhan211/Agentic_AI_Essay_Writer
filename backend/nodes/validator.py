from langchain_groq import ChatGroq

from config import (
    GROQ_API_KEY,
    GROQ_MODEL,
)

from schemas.validator_schema import ValidationResult


llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model=GROQ_MODEL,
    temperature=0,
)

structured_llm = llm.with_structured_output(ValidationResult)


def validator_node(state):

    user_input = state["idea"]

    prompt = f"""
You are an AI Essay Writer.

Your job is to determine whether the user's input is suitable for essay generation.

If the input IS suitable:
- Set is_valid to true.
- Set response to a short acknowledgement such as:
  "Great! I'll generate a well-structured essay on this topic."

If the input is NOT suitable:
- Set is_valid to false.
- Politely explain that you are an AI Essay Writer and only generate essays.
- Do NOT answer the user's question.
- Invite the user to provide an essay topic instead.
- Suggest 3–4 related essay topics when appropriate.

Examples:

Input: Artificial Intelligence
is_valid = true

Input: Climate Change
is_valid = true

Input: Tell me today's gold price
is_valid = false

Input: Who is Elon Musk?
is_valid = false

User Input:
{user_input}
"""

    result = structured_llm.invoke(prompt)

    return {
        "is_valid": result.is_valid,
        "response": result.response,
    }