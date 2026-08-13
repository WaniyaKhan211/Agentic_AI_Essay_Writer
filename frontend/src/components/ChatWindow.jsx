import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

const ChatWindow = forwardRef(function ChatWindow({
  messages,
  isTyping,
  typingStatus,
  onEditMessage,
  onRegenerateMessage,
  onFeedback,
}, ref) {
  const chatRef = useRef(null);
  const bottomRef = useRef(null);

  const [autoScroll, setAutoScroll] = useState(true);

  // Expose scrollToBottom() so ChatPage can force-scroll on send/edit
  useImperativeHandle(ref, () => ({
    scrollToBottom() {
      setAutoScroll(true);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    },
  }));

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
  }, [messages, isTyping, typingStatus, autoScroll]);

  return (
    <div className="chat-window" ref={chatRef}>
      {messages.map((message, index) => (
        <MessageBubble
          key={message.stableId ?? message.id ?? index}
          id={message.id ?? index}
          sender={message.sender}
          text={message.text}
          versions={message.versions || []}
          images={message.images}
          isStreaming={!!message.streaming}
          liked={!!message.liked}
          disliked={!!message.disliked}
          onEdit={onEditMessage}
          onRegenerate={(id, option) => onRegenerateMessage?.(id, option)}
          onFeedback={onFeedback}
        />
      ))}

      {isTyping && <TypingIndicator statusText={typingStatus} />}

      <div ref={bottomRef} />
    </div>
  );
});

export default ChatWindow;