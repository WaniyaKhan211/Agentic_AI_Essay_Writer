# Agentic AI Essay Writer

A professional AI-powered essay writing assistant built with **React**, **FastAPI**, **LangGraph**, **Groq**, and **Supabase (PostgreSQL & S3-compatible Storage)**. The application transforms a rough user idea into a polished essay by performing research, generating content, evaluating quality, generating supporting visual illustrations, and persisting all sessions and images across page refreshes.

## Features

- **Agentic Pipeline** — Validator → Web Research (Exa) → Writer (Groq) → Judge (quality scoring & iterative retries)
- **Illustrated Output** — Section images generated, with topic sanitization and safety guardrails
- **Persistent Chat** — Multi-session conversation history stored in Supabase PostgreSQL
- **Streaming UI** — Real-time generation status via Server-Sent Events
- **Message Version** — Edit and regenerate responses, with image gallery support

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | FastAPI, SSE |
| Agent Framework | LangGraph, LangChain |
| LLM | Groq |
| Web Search | Exa Search API |
| Image Generation | FLUX.1-schnell (Hugging Face) |
| Database & Storage | Supabase (PostgreSQL + Storage) |

## Project Structure

```
project/
├── backend/
│   ├── app.py                  # FastAPI app & API routes
│   ├── main.py                 # CLI entry point
│   ├── langraph_flow.py        # LangGraph pipeline definition
│   ├── nodes/                  # Graph nodes (research, writer, judge, etc.)
│   ├── schemas/                # Pydantic models
│   ├── database/                # Supabase chat & storage repositories
│   ├── prompts/                 # Prompt templates
│   └── tools/                   # Web search tool
└── frontend/
    └── src/
        ├── components/            # Chat UI components
        ├── pages/                   # Page-level views
        └── services/                # API client
```
## Author

**Waniya Khan**