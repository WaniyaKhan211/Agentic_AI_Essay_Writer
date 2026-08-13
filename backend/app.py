import asyncio
import json
import queue
import re
import threading
import traceback

from sse_starlette.sse import EventSourceResponse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from langraph_flow import essay_graph
from schemas.api_schema import EssayRequest

from nodes.title_generator import generate_title

from langchain_core.messages import HumanMessage
from langchain_core.messages import AIMessage

from database.chat_repository import (
    create_chat_session,
    save_message,
    session_exists,
    get_chat_messages,
    get_chat_sessions,
    update_session_timestamp,
    hide_messages_from,
    delete_chat_session,
    update_message_image_paths
)
from database.storage_service import upload_image_data_uri, get_accessible_url

from models.session_info import session_info


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


@app.get("/sessions")
def list_sessions():
    # Returns all persisted chat sessions (most recently updated first),
    # for populating the sidebar on page load.

    sessions = get_chat_sessions()

    return [
        {
            "id": s["session_id"],
            "title": s["title"],
        }
        for s in sessions
    ]


@app.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    if not session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found.")
    success = delete_chat_session(session_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete session.")
    return {"message": "Session deleted successfully."}


@app.get("/sessions/{session_id}/messages")
def get_session_messages(session_id: str):

    if not session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found.")

    messages = get_chat_messages(session_id)

    formatted = []
    for m in messages:
        raw_images = m.get("image_paths") or []
        formatted_images = []
        for img_item in raw_images:
            if isinstance(img_item, dict):
                path = img_item.get("path")
                if path:
                    url = get_accessible_url(path)
                    formatted_images.append({
                        "image": url,
                        "title": img_item.get("title", ""),
                        "caption": img_item.get("caption", ""),
                    })
            elif isinstance(img_item, str):
                url = get_accessible_url(img_item)
                formatted_images.append({
                    "image": url,
                })

        formatted.append({
            "id": m["message_id"],
            "sender": "user" if m["role"] == "user" else "ai",
            "text": m["content"],
            "version": m.get("version", 1),
            "parent_id": m.get("parent_id"),
            "images": formatted_images,
        })

    return formatted


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

        return (
            f"Revising the essay "
            f"(attempt {state.get('attempts', 0) + 1})..."
        )

    return STATUS_MESSAGES.get(node_name)


@app.post("/generate")
async def generate_essay(request: EssayRequest):

    thread_id = request.conversation_id
    print(request.conversation_id)
    print(type(request.conversation_id))

    if not thread_id:
        raise Exception("Conversation_id is required.")

    if thread_id not in session_info:

        session_info[thread_id] = {
            "current_session_id": thread_id,
            "is_session_new": not session_exists(thread_id)
        }

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    previous_essay = ""
    previous_research = ""
    previous_references = []

    conversation_history = []

    # Always load history from DB so the writer has full context,
    # even after a backend restart where session_info is empty.
    messages = get_chat_messages(thread_id)

    for msg in messages:

        if msg["role"] == "user":

            conversation_history.append(
                HumanMessage(
                    content=msg["content"]
                )
            )

        else:

            conversation_history.append(
                AIMessage(
                    content=msg["content"]
                )
            )

    try:

        snapshot = essay_graph.get_state(config)

        prior_values = snapshot.values if snapshot else {}

    except Exception:

        prior_values = {}

    previous_essay = prior_values.get(
        "best_essay",
        ""
    )

    if not previous_essay:

        for msg in reversed(conversation_history):

            if isinstance(msg, AIMessage):
                previous_essay = msg.content
                break

    is_followup = bool(previous_essay)

    if is_followup:

        previous_research = prior_values.get(
            "research",
            ""
        )

        previous_references = prior_values.get(
            "references",
            []
        )

    inputs = {

        "idea": request.idea,
        "session_id": thread_id,
        "conversation_history": conversation_history,

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
        "previous_essay": previous_essay
    }

    inputs["research"] = ""
    inputs["references"] = []

    async def essay_stream():

        q = queue.Queue()

        def run_agent():
            try:
                if session_info[thread_id]["is_session_new"]:
                    title = generate_title(inputs["idea"])
                    session_created = create_chat_session(thread_id, title)
                    if not session_created:
                        raise Exception("Unable to create chat session.")
                    session_info[thread_id]["is_session_new"] = False
                    q.put(("title", title))

                # Fetch existing visible messages for this session
                existing_messages = get_chat_messages(thread_id)

                if request.edited_message_id:
                    # EDIT CASE: Always prioritised — hide the original user message
                    # and its AI reply, then save the new user message.
                    # NOTE: This must be checked BEFORE the same-text regeneration
                    # check below, otherwise editing a message to identical text
                    # would fall into the regeneration branch and skip hiding,
                    # causing the old essay to reappear on page reload.
                    ai_reply = next(
                        (m for m in existing_messages if m.get("parent_id") == request.edited_message_id),
                        None
                    )
                    ids_to_hide = [request.edited_message_id]
                    if ai_reply:
                        ids_to_hide.append(ai_reply["message_id"])
                    hide_messages_from(thread_id, ids_to_hide)

                    # Save new user message
                    user_saved = save_message(
                        session_id=thread_id,
                        role="user",
                        content=request.idea,
                        status="visible",
                        version=1
                    )
                    if not user_saved:
                        raise Exception("Unable to save user message.")

                    parent_user_id = user_saved[0]["message_id"] if user_saved else None
                    next_version = 1

                    conversation_history.append(
                        HumanMessage(content=request.idea)
                    )

                else:
                    # Check if this user prompt already exists (Regeneration case)
                    existing_user_msg = next(
                        (m for m in reversed(existing_messages) if m.get("role") == "user" and m.get("content") == request.idea),
                        None
                    )

                    if existing_user_msg:
                        # REGENERATION CASE:
                        # Reuse existing user message as parent_id and increment version
                        parent_user_id = existing_user_msg.get("message_id")
                        previous_versions = [
                            m for m in existing_messages if m.get("parent_id") == parent_user_id
                        ]
                        next_version = len(previous_versions) + 1
                    else:
                        # NEW MESSAGE CASE
                        user_saved = save_message(
                            session_id=thread_id,
                            role="user",
                            content=request.idea,
                            status="visible",
                            version=1
                        )
                        if not user_saved:
                            raise Exception("Unable to save user message.")

                        parent_user_id = user_saved[0]["message_id"] if user_saved else None
                        next_version = 1

                        conversation_history.append(
                            HumanMessage(content=request.idea)
                        )

                regen_opt = request.regenerate_option or "both"
                final_state = dict(inputs)

                if regen_opt == "images":
                    # --- IMAGES ONLY REGENERATION ---
                    q.put(("status", "Generating new images for existing essay..."))
                    assistant_text = previous_essay or ""

                    essay_data = {
                        "title": request.idea,
                        "sections": [{"subheading": "Essay", "content": assistant_text}],
                    }

                    try:
                        from nodes.image_generator import generate_images
                        raw_generated_images = generate_images(topic=request.idea, essay_data=essay_data)
                    except Exception as e:
                        print("Failed to generate new images:", e)
                        raw_generated_images = []

                    final_state["is_valid"] = True
                    final_state["response"] = assistant_text
                    final_state["best_essay"] = assistant_text
                    final_state["images"] = raw_generated_images

                else:
                    # --- ESSAY ONLY OR BOTH ---
                    any_event_received = False

                    for event in essay_graph.stream(
                        inputs,
                        config=config,
                        stream_mode="updates"
                    ):
                        for node_name, state in event.items():
                            status = build_status_message(node_name, state)
                            if status:
                                q.put(("status", status))

                            final_state.update(state)
                            any_event_received = True

                    if not any_event_received:
                        raise Exception("Graph returned no result.")

                    assistant_text = (
                        final_state["response"]
                        if not final_state["is_valid"]
                        else final_state["best_essay"]
                    )

                    if regen_opt == "essay":
                        # For ESSAY ONLY: keep previous images instead of generating new ones
                        prev_ai_msg = next(
                            (m for m in reversed(existing_messages) if m.get("role") == "assistant"),
                            None
                        )
                        existing_paths = prev_ai_msg.get("image_paths", []) if prev_ai_msg else []
                        final_state["images"] = existing_paths

                # Save assistant response with parent_id and incremented version
                assistant_saved = save_message(
                    session_id=thread_id,
                    role="assistant",
                    content=assistant_text,
                    status="visible",
                    version=next_version,
                    parent_id=parent_user_id
                )

                if not assistant_saved:
                    raise Exception("Unable to save assistant response.")

                assistant_msg_id = assistant_saved[0]["message_id"] if assistant_saved else None
                raw_generated_images = final_state.get("images", [])

                if raw_generated_images and assistant_msg_id:
                    stored_image_paths = []
                    updated_images_for_frontend = []

                    for idx, img in enumerate(raw_generated_images):
                        if isinstance(img, dict) and "path" in img:
                            # Existing stored image path (for essay-only case)
                            stored_image_paths.append(img)
                            public_url = get_accessible_url(img["path"])
                            updated_images_for_frontend.append({
                                "title": img.get("title", ""),
                                "caption": img.get("caption", ""),
                                "image": public_url
                            })
                            continue

                        data_uri = img.get("image", "") if isinstance(img, dict) else ""
                        title = img.get("title", "") if isinstance(img, dict) else ""
                        caption = img.get("caption", "") if isinstance(img, dict) else ""

                        if data_uri and data_uri.startswith("data:"):
                            object_path = upload_image_data_uri(
                                data_uri=data_uri,
                                session_id=thread_id,
                                message_id=assistant_msg_id,
                                index=idx
                            )
                            if object_path:
                                stored_image_paths.append({
                                    "path": object_path,
                                    "title": title,
                                    "caption": caption
                                })
                                public_url = get_accessible_url(object_path)
                                updated_images_for_frontend.append({
                                    "title": title,
                                    "caption": caption,
                                    "image": public_url
                                })
                            else:
                                updated_images_for_frontend.append(img)
                        else:
                            updated_images_for_frontend.append(img)

                    if stored_image_paths:
                        update_message_image_paths(assistant_msg_id, stored_image_paths)

                    final_state["images"] = updated_images_for_frontend

                timestamp_updated = update_session_timestamp(thread_id)
                if not timestamp_updated:
                    raise Exception("Unable to update session timestamp.")

                conversation_history.append(
                    AIMessage(content=assistant_text)
                )

                q.put(("done", final_state))

            except Exception as e:
                print("ERROR:", e)
                traceback.print_exc()
                q.put(("error", str(e)))
        thread = threading.Thread(
            target=run_agent,
            daemon=True
        )

        thread.start()

        loop = asyncio.get_event_loop()

        final_state = None

        while True:

            kind, payload = await loop.run_in_executor(
                None,
                q.get
            )

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

        if not final_state["is_valid"]:

            response_text = final_state["response"]

        else:

            response_text = final_state["best_essay"]

        if not response_text:

            response_text = "No response generated."

        tokens = re.findall(
            r"\S+|\s+",
            response_text
        )

        for token in tokens:

            yield {
                "event": "message",
                "data": json.dumps(token)
            }

            await asyncio.sleep(0.01)

        images = final_state.get(
            "images",
            []
        )

        if images:

            yield {
                "event": "images",
                "data": json.dumps(images)
            }

    return EventSourceResponse(
        essay_stream()
    )