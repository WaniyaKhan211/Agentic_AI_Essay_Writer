import { useEffect, useRef, useState } from "react";
import {
    generateEssayStream,
    getSessions,
    getSessionMessages,
    deleteSession,
} from "../services/api";
import { v4 as uuidv4 } from "uuid";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";
import { groupMessagesWithVersions } from "../utils/messageUtils";

import "../styles/chat.css";
import "../styles/sidebar.css";
import "../styles/header.css";
import "../styles/message.css";
import "../styles/input.css";

// Small helper for stable, unique message ids
let idCounter = 0;
const generateId = () => `${Date.now()}-${idCounter++}`;

function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);

  // Stores which conversation is currently waiting for the first AI chunk
  const [typingConversationId, setTypingConversationId] = useState(null);

  // Live "agent is doing X" text shown in the typing indicator
  const [typingStatus, setTypingStatus] = useState("");

  // Keeps track of the currently in-flight stream so it can be cancelled
  const streamRef = useRef(null);
  const chatWindowRef = useRef(null);
  useEffect(() => {
    loadPreviousChats();
  }, []);

  const activeConversation = conversations.find(
    (chat) => chat.id === currentConversation
  );

  // Cancels whatever stream is currently running for a given conversation
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
  // message, and regenerating an AI response.
  const streamAIResponse = async (
    conversationId,
    promptText,
    aiMessageId,
    parentUserId = null,
    isRegeneration = false,
    editedMessageId = null,
    option = "both"
  ) => {
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
                  persisted: true,
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

                  const updatedMessages = [...chat.messages];

                  if (isRegeneration) {
                    // Find existing AI message responding to parentUserId (or with target id)
                    const targetIdx = updatedMessages.findIndex(
                      (m) =>
                        m.sender === "ai" &&
                        ((parentUserId && m.parent_id === parentUserId) ||
                          m.id === aiMessageId)
                    );

                    if (targetIdx !== -1) {
                      const targetMsg = updatedMessages[targetIdx];
                      const existingVersions = targetMsg.versions || [
                        {
                          id: targetMsg.id,
                          text: targetMsg.text,
                          version: targetMsg.version || 1,
                          images: targetMsg.images || [],
                        },
                      ];

                      const newVersionNum = existingVersions.length + 1;
                      const newVersionObj = {
                        id: aiMessageId,
                        text: chunk,
                        version: newVersionNum,
                        images: [],
                      };

                      const updatedVersions = [...existingVersions, newVersionObj];

                      updatedMessages[targetIdx] = {
                        ...targetMsg,
                        stableId: targetMsg.stableId || targetMsg.id, // never change — keeps MessageBubble mounted
                        id: aiMessageId,
                        text: chunk,
                        version: newVersionNum,
                        streaming: true,
                        versions: updatedVersions,
                      };
                    } else {
                      // Fallback: append new AI message
                      updatedMessages.push({
                        id: aiMessageId,
                        stableId: aiMessageId,
                        sender: "ai",
                        parent_id: parentUserId,
                        text: chunk,
                        images: [],
                        streaming: true,
                        version: 1,
                        versions: [
                          { id: aiMessageId, text: chunk, version: 1, images: [] },
                        ],
                      });
                    }
                  } else {
                    // Standard new message
                    updatedMessages.push({
                      id: aiMessageId,
                      stableId: aiMessageId,
                      sender: "ai",
                      parent_id: parentUserId,
                      text: chunk,
                      images: [],
                      streaming: true,
                      version: 1,
                      versions: [
                        { id: aiMessageId, text: chunk, version: 1, images: [] },
                      ],
                    });
                  }

                  return {
                    ...chat,
                    messages: updatedMessages,
                  };
                })
              );

              return;
            }

            // Subsequent chunks update the text of the streaming version
            setConversations((prev) =>
              prev.map((chat) => {
                if (chat.id !== conversationId) return chat;

                return {
                  ...chat,
                  messages: chat.messages.map((msg) => {
                    if (msg.id !== aiMessageId) return msg;

                    const newText = msg.text + chunk;
                    const updatedVersions = (msg.versions || []).map((v) =>
                      v.id === aiMessageId ? { ...v, text: v.text + chunk } : v
                    );

                    return {
                      ...msg,
                      text: newText,
                      versions: updatedVersions,
                    };
                  }),
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
                  messages: chat.messages.map((msg) => {
                    if (msg.id !== aiMessageId) return msg;

                    const updatedVersions = (msg.versions || []).map((v) =>
                      v.id === aiMessageId ? { ...v, images } : v
                    );

                    return {
                      ...msg,
                      images,
                      versions: updatedVersions,
                    };
                  }),
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
        conversationId,
        editedMessageId,
        option
      );

      // Mark message as no longer streaming
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

  const loadPreviousChats = async () => {
    try {
      const sessions = await getSessions();

      if (sessions.length === 0) {
        const id = uuidv4();

        setConversations([
          {
            id,
            title: "New Chat",
            persisted: false,
            messages: [
              {
                id: generateId(),
                sender: "ai",
                text: "Hello! Give me a topic and I will help you write an essay.",
              },
            ],
          },
        ]);

        setCurrentConversation(id);
        return;
      }

      const chats = await Promise.all(
        sessions.map(async (session) => {
          const messages = await getSessionMessages(session.id);

          const formattedMessages = messages.map((msg) => ({
            ...msg,
            images: msg.images || [],
            liked: msg.liked || false,
            disliked: msg.disliked || false,
            streaming: false,
          }));

          const groupedMessages = groupMessagesWithVersions(formattedMessages);

          return {
            id: session.id,
            title: session.title,
            persisted: true,
            messages: groupedMessages,
          };
        })
      );

      const newChat = {
        id: uuidv4(),
        title: "New Chat",
        persisted: false,
        messages: [
          {
            id: generateId(),
            sender: "ai",
            text: "Hello! Give me a topic and I will help you write an essay.",
          },
        ],
      };

      setConversations([newChat, ...chats]);
      setCurrentConversation(newChat.id);
    } catch (err) {
      console.error("Failed loading chats", err);
    }
  };

  const sendMessage = (text) => {
    const conversationId = currentConversation;
    const userMessageId = generateId();

    const userMessage = {
      id: userMessageId,
      sender: "user",
      text,
    };

    setConversations((prev) => {
      const target = prev.find((chat) => chat.id === conversationId);
      if (!target) return prev;

      const updatedChat = {
        ...target,
        messages: [...target.messages, userMessage],
      };

      return [updatedChat, ...prev.filter((chat) => chat.id !== conversationId)];
    });

    // Scroll to bottom immediately when user sends a message
    chatWindowRef.current?.scrollToBottom();

    const aiMessageId = generateId();
    streamAIResponse(conversationId, text, aiMessageId, userMessageId, false);
  };

  // Called when user edits a user message
  const editUserMessage = (messageId, newText) => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    const conversationId = currentConversation;

    abortActiveStream(conversationId);

    setConversations((prev) => {
      // Find the target conversation
      const target = prev.find((chat) => chat.id === conversationId);
      if (!target) return prev;

      // Filter out the edited user message and its AI reply (if any)
      const filteredMessages = target.messages.filter((msg) => {
        // Remove the edited user message
        if (msg.id === messageId) return false;
        // Remove AI message that has this user message as parent_id
        if (msg.parent_id === messageId) return false;
        return true;
      });

      // Append a new user message at the end
      const newUserMessage = {
        id: generateId(),
        sender: "user",
        text: trimmed,
        // The parent_id for the upcoming AI response will be set on the backend
      };

      const updatedChat = {
        ...target,
        messages: [...filteredMessages, newUserMessage],
      };

      // Return updated conversations list, keeping order (new chat on top)
      return [updatedChat, ...prev.filter((chat) => chat.id !== conversationId)];
    });

    // Scroll to bottom so the new user message and incoming response are visible
    chatWindowRef.current?.scrollToBottom();

    // Trigger backend generation with edited_message_id so old messages are hidden server‑side
    const aiMessageId = generateId();
    streamAIResponse(conversationId, trimmed, aiMessageId, null, false, messageId);
  };

  // Called when user clicks "regenerate" on an AI message
  const regenerateMessage = (aiMessageId, option = "both") => {
    const conversationId = currentConversation;
    const chat = conversations.find((c) => c.id === conversationId);
    if (!chat) return;

    const idx = chat.messages.findIndex((m) => m.id === aiMessageId);
    if (idx === -1) return;

    const targetAiMsg = chat.messages[idx];
    const precedingUser = chat.messages[idx - 1];
    const promptText = precedingUser?.text;
    if (!promptText) return;

    const parentUserId = precedingUser?.id || targetAiMsg.parent_id;

    abortActiveStream(conversationId);

    const newAiMessageId = generateId();
    streamAIResponse(conversationId, promptText, newAiMessageId, parentUserId, true, null, option);
  };

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
  };

  const createNewChat = () => {
    const newConversation = {
      id: uuidv4(),
      title: "New Chat",
      persisted: false,
      messages: [
        {
          id: generateId(),
          sender: "ai",
          text: "Hello! Give me a topic and I will help you write an essay.",
        },
      ],
    };

    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversation(newConversation.id);
  };

  const handleDeleteChat = async (id) => {
    await deleteSession(id);
    setConversations((prev) => prev.filter((chat) => chat.id !== id));
    // Always open a fresh new chat after deletion — no blank screen
    createNewChat();
  };

  return (
    <div className="app-container">
      <Sidebar
        isOpen={isSidebarOpen}
        conversations={conversations.filter((chat) => chat.persisted)}
        currentConversation={currentConversation}
        setCurrentConversation={setCurrentConversation}
        createNewChat={createNewChat}
        onDeleteChat={handleDeleteChat}
      />

      <div className="main-content">
        <Header
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />

        <div className="chat-container">
          <ChatWindow
            ref={chatWindowRef}
            messages={activeConversation?.messages || []}
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