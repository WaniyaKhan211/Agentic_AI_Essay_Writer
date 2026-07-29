from pydantic import BaseModel


class EssayRequest(BaseModel):
    idea: str


class EssayResponse(BaseModel):
    success: bool
    message: str
    essay: str