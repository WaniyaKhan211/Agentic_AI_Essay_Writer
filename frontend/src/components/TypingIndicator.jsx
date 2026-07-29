function TypingIndicator() {
  return (
    <div className="message ai">
      <div className="avatar">
        🤖
      </div>

      <div className="bubble typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

export default TypingIndicator;