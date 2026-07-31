import { useMemo, useState } from "react";
import ImageGallery from "./ImageGallery";
import {
  FiUser,
  FiCpu,
  FiCopy,
  FiRefreshCw,
  FiThumbsUp,
  FiThumbsDown,
  FiEdit2,
  FiX,
} from "react-icons/fi";
import "../styles/markdown.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";

function MessageBubble({ sender, text, images = [] }) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);

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

// Pull every markdown link [label](url) out of the raw text so we can
// show them as a single "sources" stack instead of one icon per link.
const sources = useMemo(() => {
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const seen = new Map();
  let match;

  while ((match = regex.exec(text || "")) !== null) {
    const [, label, url] = match;
    if (!seen.has(url)) {
      seen.set(url, label);
    }
  }

  return Array.from(seen, ([url, label]) => ({ url, label }));
}, [text]);

// Strip a trailing "References"/"Sources" section (heading + link list)
// out of what gets displayed — we already pulled the links out above,
// so the essay body no longer needs to show that section itself.
const cleanedText = useMemo(() => {
  if (!text) return text;

  const refSectionRegex =
    /\n{0,2}(?:#{1,6}\s*|\*{1,2}\s*)?(references|sources)\s*:?\**\s*\n[\s\S]*$/i;

  return text.replace(refSectionRegex, "").trimEnd();
}, [text]);

// Normal text link inside the message body (no more per-link favicon icon).
const LinkRenderer = ({ children, ...props }) => {
  const href = props.href;

  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
    >
      {children}
    </a>
  );
};

const visibleSources = sources.slice(0, 3);
const extraSourcesCount = sources.length - visibleSources.length;

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
  {cleanedText}
</ReactMarkdown>
  </div>

  {images.length > 0 && (
    <ImageGallery images={images} />
  )}

  {sources.length > 0 && (
    <div className="source-stack-wrapper">
      <button
        type="button"
        className="source-stack"
        onClick={() => setShowSources(true)}
      >
        <span className="source-stack-label">Sources</span>

        <span className="source-stack-icons">
          {visibleSources.map((source, index) => (
            <img
              key={source.url}
              src={getFavicon(source.url)}
              alt=""
              className="source-stack-icon"
              style={{ zIndex: visibleSources.length - index }}
            />
          ))}

          {extraSourcesCount > 0 && (
            <span className="source-stack-count">
              +{extraSourcesCount}
            </span>
          )}
        </span>
      </button>
    </div>
  )}
</div>

{showSources && (
  <div
    className="source-modal-overlay"
    onClick={() => setShowSources(false)}
  >
    <div
      className="source-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="source-modal-close"
        onClick={() => setShowSources(false)}
      >
        <FiX size={18} />
      </button>

      <div className="source-modal-list">
        {sources.map((source, index) => {
          let hostname = source.url;
          try {
            hostname = new URL(source.url).hostname.replace(/^www\./, "");
          } catch {
            /* keep raw url as a fallback */
          }

          return (
            <div key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-modal-item"
              >
                <span className="source-modal-title">
                  {source.label}
                </span>

                <span className="source-modal-url">
                  {source.url}
                </span>

                <span className="source-modal-source-row">
                  <img
                    src={getFavicon(source.url)}
                    alt=""
                    className="source-modal-favicon"
                  />
                  <span className="source-modal-hostname">
                    {hostname}
                  </span>
                </span>
              </a>

              {index < sources.length - 1 && (
                <div className="source-modal-divider" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}

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