function TypingIndicator({ statusText }) {
  return (
    <div className="message ai">
      <div className="avatar">
        🤖
      </div>

      <div className="bubble typing">
        <span className="typing-status">
          {statusText || "Thinking..."}
        </span>
      </div>
    </div>
  );
}

export default TypingIndicator;