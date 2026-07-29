import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

function ChatWindow({ messages, isTyping }) {
  const chatRef = useRef(null);
  const bottomRef = useRef(null);

  const [autoScroll, setAutoScroll] = useState(true);

  // Detect whether the user is at the bottom
  useEffect(() => {
    const chat = chatRef.current;

    if (!chat) return;

    const handleScroll = () => {
      const threshold = 30;

      const atBottom =
        chat.scrollHeight - chat.scrollTop - chat.clientHeight <= threshold;

      setAutoScroll(atBottom);
    };

    chat.addEventListener("scroll", handleScroll);

    // Initialise once
    handleScroll();

    return () => chat.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll only when allowed
  useEffect(() => {
    if (!autoScroll) return;

    bottomRef.current?.scrollIntoView({
      behavior: "auto",
    });
  }, [messages, isTyping, autoScroll]);

  return (
    <div className="chat-window" ref={chatRef}>
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id ?? index}
          sender={message.sender}
          text={message.text}
          images={message.images}
        />
      ))}

      {isTyping && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  );
}

export default ChatWindow;