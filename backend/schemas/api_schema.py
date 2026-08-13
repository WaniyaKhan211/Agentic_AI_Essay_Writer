from pydantic import BaseModel
from typing import Optional

class EssayRequest(BaseModel):
    idea: str
    conversation_id: Optional[str] = None
    edited_message_id: Optional[str] = None
    regenerate_option: Optional[str] = "both"

class EssayResponse(BaseModel):
    success: bool
    message: str
    essay: str