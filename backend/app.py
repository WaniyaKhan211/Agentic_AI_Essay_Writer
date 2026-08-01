import asyncio
import json
import re

from sse_starlette.sse import EventSourceResponse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from langraph_flow import essay_graph
from schemas.api_schema import EssayRequest


app = FastAPI(
    title="Agentic AI Essay Writer API"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():

    return {
        "message": "Agentic AI Essay Writer API is running."
    }



@app.post("/generate")
async def generate_essay(request: EssayRequest):

    result = essay_graph.invoke(
        {
            "idea": request.idea,
            "research": "",
            "references": [],
            "essay": "",
            "score": 0,
            "best_essay": "",
            "best_sections": [],
            "best_score": 0,
            "feedback": [],
            "passed": False,
            "attempts": 0,
            "is_valid": True,
            "response": "",
            "images": [],
        }
    )


    async def essay_stream():

        # Handle invalid input
        if not result["is_valid"]:

            response_text = result["response"]

        # Handle generated essay
        else:

            response_text = result["best_essay"]


        # Safety fallback
        if not response_text:

            response_text = "No response generated."


        # Split into tokens but KEEP the whitespace (spaces AND newlines)
        tokens = re.findall(r"\S+|\s+", response_text)

        for token in tokens:

        
            yield {
                "event": "message",
                "data": json.dumps(token)
            }

            await asyncio.sleep(0.01)

        images = result.get("images", [])

        if images:

            yield {
                "event": "images",
                "data": json.dumps(images)
            }



    return EventSourceResponse(
        essay_stream()
    )