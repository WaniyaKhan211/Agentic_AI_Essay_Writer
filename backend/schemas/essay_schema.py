from pydantic import BaseModel


class EssaySection(BaseModel):
    heading: str
    body: str
    bullet_points: list[str] | None = None

class Table(BaseModel):
    title: str
    headers: list[str]
    rows: list[list[str]]


class Formula(BaseModel):
    latex: str
    explanation: str


class EssayOutput(BaseModel):
    title: str
    introduction: str
    sections: list[EssaySection]
    tables: list[Table] = []
    formulas: list[Formula] = []
    conclusion: str