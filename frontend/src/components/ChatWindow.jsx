import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

function ChatWindow({ messages, isTyping }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  return (
    <div className="chat-window">
      {messages.map((message, index) => (
        <MessageBubble
  key={index}
  sender={message.sender}
  text={message.text}
  images={message.images}
/>
      ))}

      {isTyping && <TypingIndicator />}

      <div ref={bottomRef}></div>
    </div>
  );
}

export default ChatWindow;