from langchain_groq import ChatGroq

from config import (
    GROQ_API_KEY,
    GROQ_MODEL,
    TEMPERATURE,
)

# Create LLM
llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model=GROQ_MODEL,
    temperature=TEMPERATURE,
)

def generate_essay(
    user_idea: str,
    research: str = "",
    feedback: str = ""
):
    """
    Generate or regenerate an essay.
    """

    prompt = f"""
You are an expert essay writer.

IMPORTANT:
The user's exact topic is the only topic to write about.
Do not change the topic.
Do not replace it with information from research.

USER IDEA:
{user_idea}

WEB RESEARCH:
{research}
"""

    # If feedback exists, improve the previous essay
    if feedback:
        prompt += f"""

The previous essay needs improvement.

Use the following feedback to rewrite and improve the essay:

{feedback}
"""

    prompt += """

Requirements:

- Write a complete, well-structured essay.
- The essay must stay focused on the user's exact topic.
- Include an Introduction, Body, and Conclusion.
- Use formal, academic language.
- Use the web research only as supporting information.
- Fix all issues mentioned in the feedback.
- Return only the final essay.

Formatting Requirements:

- Format the entire essay in valid Markdown.
- The essay title must use:
  # Essay Title

- The main sections must use:
  ## Introduction
  ## Body
  ## Conclusion

- Subsections inside the body must use:
  ### Heading

- Do NOT write:
  *Introduction*
  *Body*
  *Conclusion*

- Do NOT use italic text for section titles.
- Do NOT add any text before or after the essay.
"""

    response = llm.invoke(prompt)

    return response.content