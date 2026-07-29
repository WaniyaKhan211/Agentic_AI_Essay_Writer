from langchain_groq import ChatGroq

from config import (
    GROQ_API_KEY,
    GROQ_MODEL,
    TEMPERATURE
)

llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model=GROQ_MODEL,
    temperature=TEMPERATURE,
)

response = llm.invoke(
    "Write a short paragraph explaining Artificial Intelligence."
)

print(response.content)