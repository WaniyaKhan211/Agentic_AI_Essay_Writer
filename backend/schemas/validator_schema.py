from pydantic import BaseModel


class ValidationResult(BaseModel):
    is_valid: bool
    response: str