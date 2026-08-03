from langchain_groq import ChatGroq

from config import (
    GROQ_API_KEY,
    GROQ_MODEL,
)


_title_llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model=GROQ_MODEL,
    temperature=0,
    max_tokens=300,
)


def generate_title(idea: str) -> str:
    

    prompt = f"""Turn the following essay request into a very short chat title.

Rules:
- 1 to 4 words only.
- Title Case.
- No punctuation, no quotes, no surrounding text.
- Do not include the word "essay".
- Just the core topic being asked about.
- Respond with ONLY the title on its own, nothing else.

Request: {idea}

Title:"""

    try:
        result = _title_llm.invoke(prompt)

        raw = (result.content or "").strip()

        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        title = lines[-1] if lines else ""

        title = title.strip().strip('"').strip("'").rstrip(".")
        title = " ".join(title.split())  # collapse any inner whitespace

        if not title:
            raise ValueError(f"Empty title returned. Raw response: {raw!r}")

        return title[:40]

    except Exception as e:
        # TEMP DEBUG LOGGING — remove once confirmed fixed.
        print("=" * 60)
        print("[title_generator] generate_title() FAILED, using fallback.")
        print(f"[title_generator] idea: {idea!r}")
        print(f"[title_generator] error type: {type(e).__name__}")
        print(f"[title_generator] error: {e}")
        print("=" * 60)

        fallback = idea.strip()

        return (fallback[:30] + "...") if len(fallback) > 30 else fallback