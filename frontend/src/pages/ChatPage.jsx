import { useState } from "react";
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

function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [conversations, setConversations] = useState([
    {
      id: 1,
      title: "New Chat",
      messages: [
        {
          sender: "ai",
          text: "Hello! Give me a topic and I will help you write an essay.",
        },
      ],
    },
  ]);

  const [currentConversation, setCurrentConversation] = useState(1);

  // Stores which conversation is currently waiting for the first AI chunk
  const [typingConversationId, setTypingConversationId] = useState(null);

  const activeConversation = conversations.find(
    (chat) => chat.id === currentConversation
  );

  const sendMessage = async (text) => {
    // Lock the conversation so switching chats won't affect streaming
    const conversationId = currentConversation;

    const userMessage = {
      sender: "user",
      text,
    };

    // Add user message
    setConversations((prev) =>
      prev.map((chat) => {
        if (chat.id !== conversationId) return chat;

        return {
          ...chat,
          title:
            chat.title === "New Chat"
              ? text.length > 30
                ? text.substring(0, 30) + "..."
                : text
              : chat.title,
          messages: [...chat.messages, userMessage],
        };
      })
    );

    // Show typing indicator
    setTypingConversationId(conversationId);

    const aiMessageId = Date.now();
    let firstChunk = true;

    try {
      await generateEssayStream(
        text,

        // Text streaming callback
        (chunk) => {
          // First chunk -> create AI message
          if (firstChunk) {
            firstChunk = false;

            // Hide typing indicator
            setTypingConversationId(null);

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
                    },
                  ],
                };
              })
            );

            return;
          }

          // Remaining chunks
          setConversations((prev) =>
            prev.map((chat) => {
              if (chat.id !== conversationId) return chat;

              return {
                ...chat,
                messages: chat.messages.map((msg) => {
                  if (msg.id === aiMessageId) {
                    return {
                      ...msg,
                      text: msg.text + chunk,
                    };
                  }

                  return msg;
                }),
              };
            })
          );
        },

        // Images callback
        (images) => {
          setConversations((prev) =>
            prev.map((chat) => {
              if (chat.id !== conversationId) return chat;

              return {
                ...chat,
                messages: chat.messages.map((msg) =>
                  msg.id === aiMessageId
                    ? {
                        ...msg,
                        images,
                      }
                    : msg
                ),
              };
            })
          );
        }
      );

      // Safety
      setTypingConversationId(null);
    } catch (error) {
      setTypingConversationId(null);

      setConversations((prev) =>
        prev.map((chat) => {
          if (chat.id !== conversationId) return chat;

          return {
            ...chat,
            messages: [
              ...chat.messages,
              {
                sender: "ai",
                text: "Unable to connect to backend.",
                images: [],
              },
            ],
          };
        })
      );

      console.error(error);
    }
  };

  const createNewChat = () => {
    const newConversation = {
      id: Date.now(),
      title: "New Chat",
      messages: [
        {
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
          />
        </div>

        <ChatInput sendMessage={sendMessage} />
      </div>
    </div>
  );
}

export default ChatPage;