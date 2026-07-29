import { useState } from "react";

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
  const [isTyping, setIsTyping] = useState(false);

  const activeConversation = conversations.find(
    (chat) => chat.id === currentConversation
  );

  const sendMessage = (text) => {
    const userMessage = {
      sender: "user",
      text: text,
    };

    // Add user message
    setConversations((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentConversation) return chat;

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

    setIsTyping(true);
    // Fake AI response
    setTimeout(() => {
      setIsTyping(false);
      const aiMessage = {
  sender: "ai",
  text: `# Essay

This is a sample essay generated for:

**${text}**

Later this text will come from your FastAPI backend.`,

  images: [
    "https://picsum.photos/400?1",
    "https://picsum.photos/400?2",
    "https://picsum.photos/400?3",
    "https://picsum.photos/400?4",
  ],
};

      setConversations((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentConversation) return chat;

          return {
            ...chat,
            messages: [...chat.messages, aiMessage],
          };
        })
      );
    }, 1000);
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
  isTyping={isTyping}
/>
        </div>

        <ChatInput sendMessage={sendMessage} />
      </div>
    </div>
  );
}

export default ChatPage;