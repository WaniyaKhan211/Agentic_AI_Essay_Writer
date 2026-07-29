# Agentic AI Essay Writer

A professional AI-powered essay writing assistant built with **React**, **FastAPI**, **LangGraph**, and **Groq**. The application transforms a rough user idea into a polished essay by performing research, generating content, evaluating quality, and iteratively improving the result before presenting it to the user.

## Features

### Frontend

- Professional chatbot interface built with React + Vite
- Collapsible sidebar with chat history
- Multiple conversation support
- User and AI message bubbles with avatars
- Markdown rendering for formatted essays
- Auto-growing input area
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
- Input validation guardrail that only accepts essay-related requests
- Modular prompts, schemas, tools, and configuration

## Upcoming Features

- AI image generation
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
- Groq
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
    ├── Score ≥ Threshold → Final Essay
    │
    └── Score < Threshold
            │
            ▼
      Retry (Maximum 3 Attempts)
            │
            ▼
Highest Scoring Essay Selected
            │
            ▼
Real-Time SSE Streaming
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
│   ├── prompts/
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
- ⏳ AI image generation
- ⏳ Conversation memory
- ⏳ Long-term user preferences
- ⏳ Summarisation middleware
- ⏳ Persistent chat storage

## Future Goals

- AI-generated images
- Long-term conversation memory
- User preference learning
- Summarisation middleware
- Persistent chat history
- Production deployment

## Author

**Waniya Khan**