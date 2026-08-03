import { useRef, useState } from "react";
import { generateEssayStream } from "../services/api";

import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";

import "../styles/chat.css";
import "../styles/sidebar.css";
import "../styles/header.css";
import "../styles/message.css";
import "../styles/input.css";

// Small helper for stable, unique message ids (Date.now() alone can collide
// when a user message and its AI reply are created within the same ms).
let idCounter = 0;
const generateId = () => `${Date.now()}-${idCounter++}`;

function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [conversations, setConversations] = useState([
    {
      id: 1,
      title: "New Chat",
      messages: [
        {
          id: generateId(),
          sender: "ai",
          text: "Hello! Give me a topic and I will help you write an essay.",
        },
      ],
    },
  ]);

  const [currentConversation, setCurrentConversation] = useState(1);

  // Stores which conversation is currently waiting for the first AI chunk
  const [typingConversationId, setTypingConversationId] = useState(null);

  // Live "agent is doing X" text shown in the typing indicator
  const [typingStatus, setTypingStatus] = useState("");

  // Keeps track of the currently in-flight stream so it can be cancelled
  // (e.g. when the user edits a message mid-generation).
  const streamRef = useRef(null);

  const activeConversation = conversations.find(
    (chat) => chat.id === currentConversation
  );

  // Cancels whatever stream is currently running for a given conversation,
  // if any. Safe to call even if nothing is streaming.
  const abortActiveStream = (conversationId) => {
    if (
      streamRef.current &&
      streamRef.current.conversationId === conversationId
    ) {
      streamRef.current.controller.abort();
      streamRef.current = null;
    }

    if (conversationId === currentConversation) {
      setTypingConversationId(null);
      setTypingStatus("");
    }
  };

  // Core streaming routine shared by: sending a new message, editing a
  // message, and regenerating an AI response. `promptText` is what gets
  // sent to the backend; `aiMessageId` is the id the (new) AI bubble will
  // use so we can target it with subsequent chunks.
  const streamAIResponse = async (conversationId, promptText, aiMessageId) => {
    const controller = new AbortController();
    streamRef.current = { conversationId, aiMessageId, controller };

    if (conversationId === currentConversation) {
      setTypingConversationId(conversationId);
      setTypingStatus("Thinking...");
    }

    let firstChunk = true;

    try {
      await generateEssayStream(
        promptText,
        {
          onTitle: (title) => {
            setConversations((prev) =>
              prev.map((chat) => {
                if (chat.id !== conversationId) return chat;
                if (chat.title !== "New Chat") return chat;

                return {
                  ...chat,
                  title,
                };
              })
            );
          },

          onStatus: (status) => {
            if (conversationId === currentConversation) {
              setTypingStatus(status);
            }
          },

          onChunk: (chunk) => {
            if (firstChunk) {
              firstChunk = false;

              if (conversationId === currentConversation) {
                setTypingConversationId(null);
                setTypingStatus("");
              }

              setConversations((prev) =>
                prev.map((chat) => {
                  if (chat.id !== conversationId) return chat;

                  return {
                    ...chat,
                    messages: [
                      ...chat.messages,
                      {
                        id: aiMessageId,
                        sender: "ai",
                        text: chunk,
                        images: [],
                        streaming: true,
                      },
                    ],
                  };
                })
              );

              return;
            }

            setConversations((prev) =>
              prev.map((chat) => {
                if (chat.id !== conversationId) return chat;

                return {
                  ...chat,
                  messages: chat.messages.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, text: msg.text + chunk }
                      : msg
                  ),
                };
              })
            );
          },

          onImages: (images) => {
            setConversations((prev) =>
              prev.map((chat) => {
                if (chat.id !== conversationId) return chat;

                return {
                  ...chat,
                  messages: chat.messages.map((msg) =>
                    msg.id === aiMessageId ? { ...msg, images } : msg
                  ),
                };
              })
            );
          },

          onError: () => {
            if (conversationId === currentConversation) {
              setTypingConversationId(null);
              setTypingStatus("");
            }

            setConversations((prev) =>
              prev.map((chat) => {
                if (chat.id !== conversationId) return chat;

                return {
                  ...chat,
                  messages: [
                    ...chat.messages,
                    {
                      id: generateId(),
                      sender: "ai",
                      text: "Something went wrong while generating your essay.",
                      images: [],
                    },
                  ],
                };
              })
            );
          },
        },
        controller.signal,
        conversationId
      );

      // Mark this AI message as no longer streaming so the regenerate
      // button becomes visible again.
      setConversations((prev) =>
        prev.map((chat) => {
          if (chat.id !== conversationId) return chat;

          return {
            ...chat,
            messages: chat.messages.map((msg) =>
              msg.id === aiMessageId ? { ...msg, streaming: false } : msg
            ),
          };
        })
      );

      if (conversationId === currentConversation) {
        setTypingConversationId(null);
        setTypingStatus("");
      }
    } catch (error) {
      // Aborted on purpose (user edited a message mid-stream) — the
      // in-progress AI bubble has already been (or is about to be) removed
      // by the caller, so there's nothing else to do here.
      if (error.name === "AbortError") {
        return;
      }

      if (conversationId === currentConversation) {
        setTypingConversationId(null);
        setTypingStatus("");
      }

      setConversations((prev) =>
        prev.map((chat) => {
          if (chat.id !== conversationId) return chat;

          return {
            ...chat,
            messages: [
              ...chat.messages,
              {
                id: generateId(),
                sender: "ai",
                text: "Unable to connect to backend.",
                images: [],
              },
            ],
          };
        })
      );

      console.error(error);
    } finally {
      if (
        streamRef.current &&
        streamRef.current.conversationId === conversationId &&
        streamRef.current.aiMessageId === aiMessageId
      ) {
        streamRef.current = null;
      }
    }
  };

  const sendMessage = (text) => {
    const conversationId = currentConversation;

    const userMessage = {
      id: generateId(),
      sender: "user",
      text,
    };

    setConversations((prev) =>
      prev.map((chat) => {
        if (chat.id !== conversationId) return chat;

        return {
          ...chat,
          messages: [...chat.messages, userMessage],
        };
      })
    );

    const aiMessageId = generateId();
    streamAIResponse(conversationId, text, aiMessageId);
  };

  // Called when the user edits one of their own messages. Truncates
  // everything after that message (including whatever AI reply followed,
  // finished or not), cancels any in-flight generation, then re-generates
  // for the edited text.
  const editUserMessage = (messageId, newText) => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    const conversationId = currentConversation;

    abortActiveStream(conversationId);

    setConversations((prev) =>
      prev.map((chat) => {
        if (chat.id !== conversationId) return chat;

        const idx = chat.messages.findIndex((m) => m.id === messageId);
        if (idx === -1) return chat;

        const truncated = chat.messages.slice(0, idx);
        truncated.push({ ...chat.messages[idx], text: trimmed });

        return { ...chat, messages: truncated };
      })
    );

    const aiMessageId = generateId();
    streamAIResponse(conversationId, trimmed, aiMessageId);
  };

  // Called when the user hits "regenerate" on an AI message. Removes that
  // AI message (and anything after it), then re-runs generation using the
  // same preceding user prompt.
  const regenerateMessage = (aiMessageId) => {
    const conversationId = currentConversation;
    const chat = conversations.find((c) => c.id === conversationId);
    if (!chat) return;

    const idx = chat.messages.findIndex((m) => m.id === aiMessageId);
    if (idx === -1) return;

    const precedingUser = chat.messages[idx - 1];
    const promptText = precedingUser?.text;
    if (!promptText) return;

    abortActiveStream(conversationId);

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c;
        return { ...c, messages: c.messages.slice(0, idx) };
      })
    );

    const newAiMessageId = generateId();
    streamAIResponse(conversationId, promptText, newAiMessageId);
  };

  // Records like/dislike on a message. For now this just updates local UI
  // state; hook this up to a backend endpoint later to persist the signal
  // as part of the user's long-term preferences.
  const setMessageFeedback = (messageId, type) => {
    setConversations((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentConversation) return chat;

        return {
          ...chat,
          messages: chat.messages.map((msg) => {
            if (msg.id !== messageId) return msg;

            if (type === "like") {
              return { ...msg, liked: !msg.liked, disliked: false };
            }

            return { ...msg, disliked: !msg.disliked, liked: false };
          }),
        };
      })
    );

    // TODO: send { messageId, type } to the backend so it can be stored
    // against the user's long-term memory / preference profile.
  };

  const createNewChat = () => {
    const newConversation = {
      id: Date.now(),
      title: "New Chat",
      messages: [
        {
          id: generateId(),
          sender: "ai",
          text: "Hello! Give me a topic and I will help you write an essay.",
        },
      ],
    };

    setConversations((prev) => [...prev, newConversation]);
    setCurrentConversation(newConversation.id);
  };

  return (
    <div className="app-container">
      <Sidebar
        isOpen={isSidebarOpen}
        conversations={conversations}
        currentConversation={currentConversation}
        setCurrentConversation={setCurrentConversation}
        createNewChat={createNewChat}
      />

      <div className="main-content">
        <Header
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />

        <div className="chat-container">
          <ChatWindow
            messages={activeConversation.messages}
            isTyping={typingConversationId === currentConversation}
            typingStatus={typingStatus}
            onEditMessage={editUserMessage}
            onRegenerateMessage={regenerateMessage}
            onFeedback={setMessageFeedback}
          />
        </div>

        <ChatInput sendMessage={sendMessage} />
      </div>
    </div>
  );
}

export default ChatPage;
