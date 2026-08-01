# Agentic AI Essay Writer

A professional AI-powered essay writing assistant built with **React**, **FastAPI**, **LangGraph**, and **Groq**. The application transforms a rough user idea into a polished essay by performing research, generating content, evaluating quality, and iteratively improving the result before presenting it to the user.

## Features

### Frontend

- Professional chatbot interface built with React + Vite
- Collapsible sidebar with chat history
- Multiple conversation support
- User and AI message bubbles with avatars
- Markdown rendering for formatted essays
- AI typing indicator
- Real-time streamed essay responses (SSE)
- Copy, Edit, Regenerate, Like, and Dislike action buttons
- Image gallery UI for AI-generated images

### Backend

- FastAPI REST API
- Server-Sent Events (SSE) streaming
- LangGraph workflow
- Exa web search integration
- Essay generation with Groq LLM
- Essay evaluation using structured Pydantic output
- Automatic retry until the quality threshold is reached
- Best essay selection after evaluation
- Input validation guardrail (LLM-based) that only accepts essay-related requests
- AI image generation
- **Image safety guardrails**:
  - Sensitive-topic detection (religious/cultural keywords) before generation
  - Unsafe-word sanitization stripped from any text sent to the LLM/image model
  - Automatic face-blurring (OpenCV Haar cascade) applied to generated images on sensitive topics, as a last line of defense
  - Negative prompting to keep output photorealistic and free of text/watermarks/logos
  - Retry logic for both the prompt-writing LLM call and the image generation call, with graceful fallback if either keeps failing
- Modular prompts, schemas, tools, and configuration

## Upcoming Features

- Conversation memory
- Long-term user preferences
- Summarisation middleware
- Persistent chat storage
- Multi-session conversation history

---

# Tech Stack

## Frontend

- React
- Vite
- React Markdown
- React Icons
- CSS

## Backend

- FastAPI
- LangGraph
- LangChain
- Groq (essay writing, evaluation, validation, and image-prompt generation)
- Hugging Face Inference Providers
- OpenCV (face-blurring guardrail on generated images)
- Exa Search API
- Pydantic
- Server-Sent Events (SSE)

---

# Project Workflow

```text
User Idea
    │
    ▼
Input Validation (Guardrail)
    │
    ▼
Web Research
    │
    ▼
Essay Generation
    │
    ▼
AI Evaluation
    │
    ▼
Quality Check
    │
    ├── Score ≥ Threshold ─────────┐
    │                              │
    └── Score < Threshold          │
            │                      │
            ▼                      │
      Retry (Maximum 3 Attempts)   │
            │                      │
            └──────────────────────┤
                                    ▼
                    Highest Scoring Essay Selected
                                    │
                                    ▼
                          AI Image Generation
                                    │
                                    ▼
                       Real-Time SSE Streaming
                       (essay text, then images)
                                    │
                                    ▼
                        React Chat Interface
```

## Project Structure

```text
Agentic_AI_Essay_Writer/
│
├── backend/
│   ├── app.py
│   ├── langraph_flow.py
│   ├── config.py
│   ├── nodes/
│   │   ├── graph.py           
│   │   ├── validator.py      
│   │   ├── research.py         
│   │   ├── writer.py         
│   │   ├── judge.py         
│   │   └── image_generator.py  
│   ├── prompts/
│   │   ├── judge_prompt.py
│   │   └── image_prompt.py    
│   ├── schemas/
│   ├── tools/
│   └── ...
│
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   ├── styles/
    │   ├── assets/
    │   └── ...
    └── ...
```

## Current Progress

- ✅ LangGraph essay generation workflow completed
- ✅ Essay evaluation and retry pipeline completed
- ✅ Input validation guardrail implemented
- ✅ Exa web research integration completed
- ✅ FastAPI backend completed
- ✅ React chatbot UI completed
- ✅ Frontend and backend integration completed
- ✅ Real-time SSE streaming completed
- ✅ AI image generation completed (LLM-generated prompts per essay section → FLUX image model, with sensitive-topic detection, sanitization, negative prompting, and automatic face-blurring)
- ⏳ Conversation memory
- ⏳ Long-term user preferences
- ⏳ Summarisation middleware
- ⏳ Persistent chat storage

## Author

**Waniya Khan**