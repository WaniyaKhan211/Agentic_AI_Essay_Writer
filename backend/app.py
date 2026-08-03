import asyncio
import json
import queue
import re
import threading
import uuid

from sse_starlette.sse import EventSourceResponse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from langraph_flow import essay_graph
from schemas.api_schema import EssayRequest
from nodes.title_generator import generate_title


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


# Friendly progress messages shown to the user while the agent works.
STATUS_MESSAGES = {
    "validator": "Understanding your request...",
    "research": "Researching your topic...",
    "writer": "Writing the essay draft...",
    "images": "Generating supporting images...",
}


def build_status_message(node_name, state):

    if node_name == "judge":
        if state.get("passed") or state.get("attempts", 0) >= 3:
            return "Finalizing your essay..."

        return f"Revising the essay (attempt {state.get('attempts', 0) + 1})..."

    return STATUS_MESSAGES.get(node_name)


@app.post("/generate")
async def generate_essay(request: EssayRequest):

    thread_id = request.conversation_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    previous_essay = ""
    previous_research = ""
    previous_references = []

    try:
        snapshot = essay_graph.get_state(config)
        prior_values = snapshot.values if snapshot else {}
    except Exception:
        prior_values = {}

    previous_essay = prior_values.get("best_essay", "")
    is_followup = bool(previous_essay)

    if is_followup:
        previous_research = prior_values.get("research", "")
        previous_references = prior_values.get("references", [])

    inputs = {
        "idea": request.idea,
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
        "is_followup": is_followup,
        "previous_essay": previous_essay,
    }

    if is_followup:
        
        inputs["research"] = previous_research
        inputs["references"] = previous_references
    else:
        # Brand new topic: start research/references fresh.
        inputs["research"] = ""
        inputs["references"] = []

    async def essay_stream():

        q: "queue.Queue" = queue.Queue()

        def run_agent():

            try:

                if not is_followup:
                    title = generate_title(inputs["idea"])
                    q.put(("title", title))

                state = dict(inputs)

                for update in essay_graph.stream(
                    inputs, config=config, stream_mode="updates"
                ):

                    for node_name, delta in update.items():

                        state.update(delta)

                        message = build_status_message(node_name, state)

                        if message:
                            q.put(("status", message))

                q.put(("done", state))

            except Exception as e:

                q.put(("error", str(e)))

        thread = threading.Thread(target=run_agent, daemon=True)
        thread.start()

        loop = asyncio.get_event_loop()
        final_state = None

        # Drain progress/title events until the graph is done (or errors).
        while True:

            kind, payload = await loop.run_in_executor(None, q.get)

            if kind == "title":
                yield {
                    "event": "title",
                    "data": json.dumps(payload)
                }

            elif kind == "status":
                yield {
                    "event": "status",
                    "data": json.dumps(payload)
                }

            elif kind == "done":
                final_state = payload
                break

            elif kind == "error":
                yield {
                    "event": "error",
                    "data": json.dumps(payload)
                }
                return

        # Handle invalid input
        if not final_state["is_valid"]:

            response_text = final_state["response"]

        # Handle generated essay
        else:

            response_text = final_state["best_essay"]

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

        images = final_state.get("images", [])

        if images:

            yield {
                "event": "images",
                "data": json.dumps(images)
            }

    return EventSourceResponse(
        essay_stream()
    )