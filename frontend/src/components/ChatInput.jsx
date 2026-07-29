import { useRef, useState } from "react";

function ChatInput({ sendMessage }) {
  const [text, setText] = useState("");

  const textareaRef = useRef(null);

  const handleSend = () => {
    if (text.trim() === "") {
      return;
    }

    sendMessage(text);

    setText("");

    textareaRef.current.style.height = "auto";
  };

  return (
    <div className="chat-input">
      <textarea
        ref={textareaRef}
        value={text}
        placeholder="Type your idea here..."
        rows={1}
        onChange={(e) => {
          setText(e.target.value);

          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height =
            textareaRef.current.scrollHeight + "px";
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
      />

      <button onClick={handleSend}>
        Send
      </button>
    </div>
  );
}

export default ChatInput;