from langchain_groq import ChatGroq
from utils.markdown_formatter import format_markdown
from schemas.essay_schema import EssayOutput
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
    references=None,
    feedback: str = "",
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

    prompt +="""
You are a professional essay writer.

Return the response using the provided structured schema.

Field Requirements

title
- Write a concise and engaging essay title.

introduction
- Write a clear introduction to the topic.

sections
- Divide the essay into logical sections.
- Each section must contain:
    - heading
    - body
- Use complete paragraphs.
- Use bullet points whenever they improve readability.
- Use numbered lists for sequential information.

Body Formatting Rules

The "body" field of every section MUST contain valid GitHub Markdown.

Use Markdown to improve readability.

Formatting requirements:

- Bold (**text**) important concepts, scientific terms, definitions, molecule names, technologies, keywords, numerical values, and important results.

- Italicize (*text*) first definitions, foreign words, and emphasis when appropriate.

- Use bullet lists whenever multiple points are explained.

- Use numbered lists for ordered information.

- Use inline LaTeX using $...$ for variables and symbols.

Example:
The molecule **ATP** stores approximately **30.5 kJ·mol⁻¹** of energy.

The variable $x$ represents the input feature.

Do not return plain text when Markdown formatting improves readability.

tables

If a comparison would improve the essay, create one or more tables.

Each table must contain:

title

headers
A list of column names.

rows
A list of rows.
Each row is a list of strings.

Example

title:
Comparison

headers:
[
"Feature",
"School",
"University"
]

rows:
[
["Schedule","Fixed","Flexible"],
["Cost","Low","High"]
]

Do NOT return markdown inside the table.
Return structured data only.

formulas
Only generate formulas when the topic genuinely requires mathematical,
scientific, engineering, economic, statistical, financial,
physics, chemistry, biology, machine learning,
computer science, or quantitative reasoning.

Examples where formulas SHOULD be generated:
- Physics
- Mathematics
- Chemistry
- Biology (when biochemical equations are relevant)
- Machine Learning
- Statistics
- Data Science
- Engineering
- Economics (economic models)
- Finance (compound interest, NPV, etc.)

Examples where formulas SHOULD NOT be generated:
- History
- Politics
- Elections
- Literature
- Geography
- Philosophy
- Law
- Psychology (unless discussing statistical models)
- Sociology
- Business essays without mathematical analysis
- General education topics

If no meaningful formula naturally belongs in the essay,
return an empty list.

Return:

latex

explanation

Example:

{
    "latex":"E = mc^2",
    "explanation":"Mass–energy equivalence."
}
Mathematics Formatting Rules

Use Markdown LaTeX only.

Inline equations must use:

$x$

Display equations must use:

$$
equation
$$

Do NOT use:

\(...\)

or

\[...\]

conclusion
- Summarise the essay.
Formatting Intelligence

Decide automatically which elements are appropriate for the topic.

- Do NOT create tables unless they improve understanding.
- Do NOT create formulas unless they naturally belong to the subject.
- Do NOT force technical formatting into non-technical essays.
- Use bullets only when they improve readability.
- Prefer normal paragraphs for narrative topics.

General Rules

- Keep the essay well structured.
- Use formal academic language.
- Use research only when relevant.
- Never invent facts or statistics.
- Every statistic must come from the supplied research.
- If a comparison exists, at least one table is REQUIRED.
- Never leave a comparison section without a table.
"""
    print("\n========== REFERENCES ==========")
    print(references)
    print("===============================\n")


    structured_llm = llm.with_structured_output(EssayOutput)

    max_attempts = 3
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            essay_data = structured_llm.invoke(prompt)
            break
        except Exception as e:
            last_error = e
            print(f"[writer] attempt {attempt} failed: {e}")
    else:
        # All attempts failed — raise a clear error instead of a raw groq exception
        raise RuntimeError(
            "The essay model returned malformed output after "
            f"{max_attempts} attempts. Please try again."
        ) from last_error

    essay = format_markdown(essay_data)
    # Append references at the end
    if references:
        essay += "\n\n"
        essay += "## References\n"

        for ref in references:
            essay += f"- [{ref['title']}]({ref['url']})\n"

    sections = [
        {"heading": section.heading, "body": section.body}
        for section in essay_data.sections
    ]

    return {
        "markdown": essay,
        "title": essay_data.title,
        "sections": sections,
    }