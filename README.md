# Agentic AI Essay Writer

A professional AI-powered essay writing assistant built with **React**, **FastAPI**, **LangGraph**, **Groq**, and **Supabase**. The application transforms rough user ideas into polished essays by performing deep research, generating structured content, evaluating quality, generating supporting visual illustrations, and persisting all sessions.

## 🚀 Key Features

- **Agentic Pipeline** — Multi-step LangGraph flow: Validator → Web Research (Exa) → Writer (Groq) → Judge (evaluator with iterative retries).
- **Selective Regeneration** — Dropdown menu options to regenerate **Both** (essay & images), **Essay** only (retains current illustrations), or **Images** only (retains current essay).
- **High-Quality PDF Export** — Custom client-side PDF compilation using `jsPDF` with advanced font styling, paginated wrapping, centered illustrations, and automated footer page numbering.
- **Robust UI & Tables** — Responsive design featuring horizontal table scrolling, loading states, and optimized layout boundaries (preventing mobile letter-spread glitches).
- **Illustrated Output** — Context-aware visual illustrations generated via FLUX.1-schnell with topic safety guardrails.
- **Persistent Multi-Session** — Complete conversation history and generated assets stored in Supabase PostgreSQL & Storage.
- **Streaming UI** — Real-time generation status and text streaming via Server-Sent Events (SSE).

## 🛠️ Tech Stack

| Layer | Technology | Key Capabilities |
|---|---|---|
| **Frontend** | React, Vite, jsPDF | UI Interface, Streaming & Client-side PDF Generation |
| **Backend** | FastAPI, SSE | REST APIs & Server-Sent Events |
| **Agentic Framework** | LangGraph, LangChain | Flow orchestration, retry loops, state management |
| **Language Model** | OpenAI Harmony (gpt-oss-120b) via Groq | Prompt validation, essay writing, evaluation scoring |
| **Web Search** | Exa Search API | Contextual search, fact-checking, reference collection |
| **Image Generation** | FLUX.1-schnell (Hugging Face) | Section-specific inline visual illustrations |
| **Database & Storage** | Supabase (PostgreSQL + Storage) | Chat session persistence, message histories, image hosting |

## 📁 Project Structure

```text
project/
├── backend/
│   ├── app.py                  # FastAPI application & API endpoints
│   ├── config.py               # API keys, model variables, and scoring settings
│   ├── langraph_flow.py        # LangGraph workflow pipeline definition
│   ├── nodes/                  # Agent nodes (validator, research, writer, judge, etc.)
│   ├── schemas/                # Pydantic models (API requests, essay schemas)
│   ├── database/               # Supabase interface layers & queries
│   └── tools/                  # Exa Search API integration
└── frontend/
    └── src/
        ├── components/         # Chat window, message bubbles, and control buttons
        ├── pages/              # ChatPage views & layout templates
        ├── services/           # Backend streaming API clients
        ├── utils/              # PDF export formatter
        └── styles/             # Layout, markdown, and typography stylesheets
```

## ⚙️ Quick Start

### 1. Backend Setup
1. Navigate to the `backend/` directory.
2. Create and configure your `.env` file.
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the development server:
   ```bash
   uvicorn app:app --reload
   ```

### 2. Frontend Setup
1. Navigate to the `frontend/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

---
**Author:** Waniya Khan