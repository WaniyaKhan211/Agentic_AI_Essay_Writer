from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage

from config import (
    GROQ_API_KEY,
    GROQ_MODEL,
)

from schemas.validator_schema import ValidationResult
from utils.history_formatter import format_conversation_history


llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model=GROQ_MODEL,
    temperature=0,
)

structured_llm = llm.with_structured_output(ValidationResult)


def validator_node(state):

    user_input = state["idea"]
    conversation_history = state.get("conversation_history", [])

    history_text = format_conversation_history(conversation_history)

    context_section = ""
    if history_text:
        context_section = f"""
CONVERSATION SO FAR (use this to understand follow-up messages):
{history_text}

"""

    prompt = f"""
You are an AI Essay Writer.

Your job is to determine whether the user's input is suitable for essay generation.

{context_section}IMPORTANT — Follow-up messages:
If there is a conversation history above, the user's current message may be a
follow-up or clarification of their previous essay request (e.g. refining a
topic, specifying a region, asking for more detail). In that case, treat it as
a valid essay request — do NOT reject it just because it looks like a short
conversational reply on its own.

If the input IS suitable:
- Set is_valid to true.
- Set response to a short acknowledgement such as:
  "Great! I'll generate a well-structured essay on this topic."

If the input is NOT suitable (completely unrelated to essay writing with no
prior essay context):
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

Input: Tell me today's gold price  (no history)
is_valid = false

Input: Who is Elon Musk?  (no history)
is_valid = false

Input: "i am talking about the new coming elections after 2026"
  with history showing previous essay about Pakistan elections
is_valid = true  ← this is a follow-up, not a random question

Current User Input:
{user_input}
"""

    result = structured_llm.invoke(prompt)

    return {
        "is_valid": result.is_valid,
        "response": result.response,
    }