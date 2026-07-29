from langchain_groq import ChatGroq

from config import GROQ_API_KEY,GROQ_MODEL

from tools.web_search import search_web


# Research is a planning task, not a creative task
decision_llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model=GROQ_MODEL,
    temperature=0,
)


def decide_and_research(user_idea: str) -> str:
    """
    First attempt research process:

    1. Ask LLM to create a search query.
    2. Use Exa search tool.
    3. Format results.
    
    This node runs only once because LangGraph retry goes
    directly from judge -> writer.
    """

    response = decision_llm.invoke(
        f"""
The user wants an essay about this topic:

"{user_idea}"

Create a useful web search query to collect information for writing
a high-quality essay.

The search query should help find:
- factual information
- statistics
- examples
- important points
- recent information if available

Keep the user's topic unchanged.

Return only the search query text.
"""
    )


    query = response.content.strip()


    print(f"[Research] Searching web for: {query}")


    raw_results = search_web(query)


    return format_search_results(raw_results)



def format_search_results(results) -> str:
    """
    Extract useful content from Exa results.
    """

    try:

        return "\n\n".join(
            f"Source: {r.url}\n{(r.text or '')[:500]}"
            for r in results.results
        )

    except AttributeError:

        return str(results)