import re

from schemas.essay_schema import EssayOutput


def bold_display_equations(text: str) -> str:
    """
    Automatically wrap every display equation ($$...$$)
    with \\boldsymbol{...}, unless it is already bold.
    """

    def replacer(match):
        equation = match.group(1).strip()

        # Skip if already wrapped
        if equation.startswith(r"\boldsymbol{"):
            return match.group(0)

        return f"$$\n\\boldsymbol{{{equation}}}\n$$"

    return re.sub(
        r"\$\$(.*?)\$\$",
        replacer,
        text,
        flags=re.DOTALL,
    )


def format_markdown(data: EssayOutput) -> str:

    md = f"# {data.title}\n\n"

    # Introduction
    md += "## Introduction\n"
    md += data.introduction.strip()
    md += "\n\n---\n\n"

    # Sections
    for section in data.sections:
        md += f"## {section.heading}\n"

        # Automatically bold display equations in section body
        body = bold_display_equations(section.body.strip())
        md += body

        if section.bullet_points:
            md += "\n\n"
            for point in section.bullet_points:
                md += f"- {point}\n"

        md += "\n\n"

    # Formulas
    if data.formulas:
        md += "---\n\n"
        md += "## Formula(s)\n"

        for formula in data.formulas:
            md += "$$\n"
            md += "\\boldsymbol{" + formula.latex.strip() + "}"
            md += "\n$$\n\n"

            md += formula.explanation.strip()
            md += "\n\n"

    # Tables
    if data.tables:
        md += "---\n\n"

        for table in data.tables:
            md += f"## {table.title}\n"

            # Header row (bold)
            md += "| "
            md += " | ".join(f"**{header}**" for header in table.headers)
            md += " |\n"

            # Separator
            md += "| "
            md += " | ".join(["---"] * len(table.headers))
            md += " |\n"

            # Data rows
            for row in table.rows:
                formatted_row = []

                for i, cell in enumerate(row):
                    # Bold first column
                    if i == 0:
                        formatted_row.append(f"**{cell}**")
                    else:
                        formatted_row.append(cell)

                md += "| "
                md += " | ".join(formatted_row)
                md += " |\n"

            md += "\n"

    # Conclusion
    md += "---\n\n"
    md += "## Conclusion\n"
    md += data.conclusion.strip()

    return md