from pydantic import BaseModel
from typing import Optional

class EssayRequest(BaseModel):
    idea: str
    conversation_id: Optional[str] = None

class EssayResponse(BaseModel):
    success: bool
    message: str
    essay: str