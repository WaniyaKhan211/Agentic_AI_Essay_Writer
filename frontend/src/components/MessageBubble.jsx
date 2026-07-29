import { useState } from "react";
import ImageGallery from "./ImageGallery";
import {
  FiUser,
  FiCpu,
  FiCopy,
  FiRefreshCw,
  FiThumbsUp,
  FiThumbsDown,
  FiEdit2,
} from "react-icons/fi";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MessageBubble({ sender, text, images = [] }) {
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    await navigator.clipboard.writeText(text);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <div className={`message ${sender}`}>
      <div className="avatar">
        {sender === "user" ? (
          <FiUser size={20} />
        ) : (
          <FiCpu size={20} />
        )}
      </div>

      <div className="message-content">

        <div className="bubble">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {text}
          </ReactMarkdown>

          {images.length > 0 && (
  <ImageGallery images={images} />
)}
        </div>

        <div className="message-actions">

          <button
            className="copy-btn"
            onClick={copyMessage}
          >
            <FiCopy size={16} />

            {copied && (
              <span className="copy-tooltip">
                Copied!
              </span>
            )}
          </button>

          {sender === "user" ? (
            <button>
              <FiEdit2 size={16} />
            </button>
          ) : (
            <>
              <button>
                <FiRefreshCw size={16} />
              </button>

              <button>
                <FiThumbsUp size={16} />
              </button>

              <button>
                <FiThumbsDown size={16} />
              </button>
            </>
          )}

        </div>

      </div>
    </div>
  );
}

export default MessageBubble;