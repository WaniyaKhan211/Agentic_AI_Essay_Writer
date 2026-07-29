# Agentic AI Essay Writer

A professional AI-powered essay writing assistant built with **React**, **FastAPI**, **LangGraph**, and **Groq**. The application transforms a rough user idea into a polished essay by performing research, generating content, evaluating quality, and iteratively improving the result before presenting it to the user.

## Features

### Frontend

* Professional chatbot interface built with React + Vite
* Collapsible sidebar with chat history
* Multiple conversation support
* User and AI message bubbles with avatars
* Markdown rendering for formatted essays
* Auto-growing input area
* AI typing indicator
* Copy, Edit, Regenerate, Like, and Dislike action buttons
* Image gallery UI for AI-generated images

### Backend

* LangGraph workflow
* Exa web search integration
* Essay generation with Groq LLM
* Essay evaluation using structured Pydantic output
* Automatic retry until the quality threshold is reached
* Best essay selection
* Modular prompts, schemas, and configuration

### Upcoming Features

* FastAPI integration
* Real-time streaming responses
* AI image generation
* Conversation memory
* Long-term user preferences
* Summarisation middleware
* Persistent chat storage

## Tech Stack

### Frontend

* React
* Vite
* React Markdown
* React Icons
* CSS

### Backend

* FastAPI
* LangGraph
* LangChain
* Groq
* Exa Search API
* Pydantic

## Project Structure

```text
Agentic_AI_Essay_Writer/
│
├── backend/
│   ├── graph.py
│   ├── config.py
│   ├── prompts/
│   ├── nodes/
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
    │   └── assets/
    └── ...
```

## Current Progress

* ✅ AI essay generation workflow completed
* ✅ Essay evaluation and retry pipeline completed
* ✅ Professional React chatbot UI completed
* 🔄 FastAPI integration in progress
* ⏳ Streaming responses
* ⏳ AI image generation
* ⏳ Memory and user preferences

## Future Goals

* Real-time streamed responses
* AI-generated images
* Persistent conversation history
* Long-term memory and user preferences

## Author

**Waniya Khan**
