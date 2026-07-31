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
  FiExternalLink,
} from "react-icons/fi";
import "../styles/markdown.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";

function MessageBubble({ sender, text, images = [] }) {
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    await navigator.clipboard.writeText(text);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const getFavicon = (url) => {
  try {
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(
      new URL(url).origin
    )}`;
  } catch {
    return "";
  }
};

const LinkRenderer = ({ children, ...props }) => {
  const href = props.href;

  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      className="favicon-link"
    >
      <img
        src={getFavicon(href)}
        alt=""
        className="favicon"
      />
    </a>
  );
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
  <div className="markdown-body">
    <ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}
  rehypePlugins={[rehypeKatex, rehypeHighlight]}
  components={{
    a: LinkRenderer,
  }}
>
  {text}
</ReactMarkdown>
  </div>

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