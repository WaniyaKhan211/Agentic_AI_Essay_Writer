# Model Selection & Technology Stack

This document explains the technologies selected for the Agentic AI Essay Writer project and the reasons for choosing each of them.

---

# Text Generation (LLM)

## Model
**openai/gpt-oss-120b (Groq)**

### Purpose
- Evaluate the user's raw idea.
- Generate the essay.
- Evaluate the generated essay.
- Score the essay.
- Generate feedback.
- Rewrite the essay until the required quality threshold is achieved.

### Why this model?
- Excellent reasoning capabilities.
- Produces high-quality long-form essays.
- Fast inference on Groq.
- Large context window.
- Supports tool calling.
- Suitable for multi-step Agentic AI workflows.

---

# Web Search

## API
**Exa Search API**

### Purpose
- Retrieve recent information.
- Verify facts.
- Collect supporting content.
- Improve essay quality and accuracy.

### Why Exa?
- Built specifically for AI applications.
- High-quality semantic search.
- Gives the agent control over when to search.
- Produces cleaner search results for LLMs.

---

# Image Generation

## Model
**black-forest-labs/FLUX.1-schnell (Hugging Face)**

### Purpose
Generate AI illustrations related to the generated essay.

### Why this model?
- Fast image generation with low latency.
- Produces high-quality images from detailed prompts.
- Cost-effective for real-time applications.
- Easily integrated through Hugging Face.

---

# Agent Framework

## Framework
**LangGraph**

### Why?
- Designed for Agentic AI applications.
- Supports multi-step workflows.
- Supports conditional routing.
- Supports tool calling.
- Supports loops and retries.
- Provides memory support.

---

# Frontend

## Framework
**React**

### Why?
- Modern and responsive user interface.
- Component-based architecture.
- Easy to build an AI Assistant style chatbot.
- Supports streaming responses.
- Easy to scale and maintain.

### Planned Features
- AI Assistant interface
- Chat history
- New Chat
- Streaming essay generation
- Display generated images after streaming

---

# Memory System

The project follows a **layered memory architecture**

---

## 1. Short-Term Memory

### Requirement
Preserve conversation history across turns.

### Current Implementation
- LangGraph Checkpointer

### Purpose
- Maintain graph state.
- Preserve recent conversation.
- Resume workflow correctly.

---

## 2. Mid-Term Memory

### Requirement
Summarization Middleware

### Current Implementation
LLM-based automatic summarization.

### Purpose
When the conversation reaches a predefined token limit, the LLM summarizes older conversation history while preserving important context.

Benefits:
- Reduces token usage.
- Prevents context window overflow.
- Keeps conversations efficient.

---

## 3. Long-Term Memory

### Requirement

Persist conversation history and context across sessions.

### Current Implementation

Supabase (PostgreSQL) — chat_sessions and chat_messages tables

### Purpose
Persist full conversation history beyond a single session or app restart.
Allow past chats to be reopened and continued with complete context.
Store generated images alongside their messages for later retrieval.

---

# Final Technology Stack

| Component | Technology |
|-----------|------------|
| Agent Framework | LangGraph |
| LLM | openai/gpt-oss-120b (Groq) |
| Web Search | Exa Search API |
| Image Generation | FLUX.1-schnell (Hugging Face) |
| Frontend | React |
| Short-Term Memory | LangGraph Checkpointer |
| Mid-Term Memory | LLM Summarization Middleware |
| Long-Term Memory | Supabase (PostgreSQL) |

---

# Selection Criteria

The selected technologies were chosen based on:

- High-quality essay generation
- Strong reasoning capability
- Fast inference
- Reliable tool calling
- Support for Agentic AI workflows
- Streaming support
- Scalability
- Ease of integration
- Modern software engineering practices
