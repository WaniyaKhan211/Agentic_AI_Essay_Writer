import { useEffect, useMemo, useRef, useState } from "react";
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
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiLoader,
} from "react-icons/fi";
import { FaThumbsUp, FaThumbsDown } from "react-icons/fa";
import "../styles/markdown.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { exportEssayToPDF } from "../utils/pdfExport";

function MessageBubble({
  id,
  sender,
  text,
  versions = [], // Array of previous/current generated versions
  images = [],
  isStreaming = false,
  liked = false,
  disliked = false,
  onEdit,
  onRegenerate,
  onFeedback,
}) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(text);

  // Active version index — starts at 0 (v1) on load/reload.
  // Automatically jumps to the latest version when regeneration
  // adds a new version during the current session.
  const [versionIdx, setVersionIdx] = useState(0);
  const prevVersionsLengthRef = useRef(versions.length);

  const [showRegenMenu, setShowRegenMenu] = useState(false);
  const regenMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (regenMenuRef.current && !regenMenuRef.current.contains(event.target)) {
        setShowRegenMenu(false);
      }
    };

    if (showRegenMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showRegenMenu]);

  useEffect(() => {
    if (versions.length > prevVersionsLengthRef.current) {
      // A new version was appended (regeneration) — show it immediately
      setVersionIdx(versions.length - 1);
    }
    prevVersionsLengthRef.current = versions.length;
  }, [versions.length]);

  // Active text to display based on selected version
  const currentText =
    versions.length > 0 && versions[versionIdx]
      ? versions[versionIdx].text
      : text;

  const currentImages =
    versions.length > 0 && versions[versionIdx]
      ? versions[versionIdx].images || []
      : images;

  const copyMessage = async () => {
    await navigator.clipboard.writeText(currentText);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const downloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      // Use the first markdown heading (or first line) as the essay title.
      const firstLine = (cleanedText || "").split("\n").find((l) => l.trim());
      const title = firstLine?.replace(/^#{1,6}\s*/, "").slice(0, 100) || "Essay";

      await exportEssayToPDF({
        title,
        markdown: cleanedText,
        images: currentImages,
      });
    } catch (err) {
      console.error("Failed to export PDF:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const startEditing = () => {
    setDraftText(currentText);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraftText(currentText);
    setIsEditing(false);
  };

  const saveEdit = () => {
    const trimmed = draftText.trim();

    if (!trimmed || trimmed === currentText) {
      setIsEditing(false);
      return;
    }

    onEdit?.(id, trimmed);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
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

  const sources = useMemo(() => {
    const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const seen = new Map();
    let match;

    while ((match = regex.exec(currentText || "")) !== null) {
      const [, label, url] = match;
      if (!seen.has(url)) {
        seen.set(url, label);
      }
    }

    return Array.from(seen, ([url, label]) => ({ url, label }));
  }, [currentText]);

  const cleanedText = useMemo(() => {
    if (!currentText) return currentText;

    const refSectionRegex =
      /\n{0,2}(?:#{1,6}\s*|\*{1,2}\s*)?(references|sources)\s*:?\**\s*\n[\s\S]*$/i;

    return currentText.replace(refSectionRegex, "").trimEnd();
  }, [currentText]);

  // Normal text link inside the message body.
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

  // Wrap tables in a horizontally-scrollable container so narrow/mobile
  // widths scroll instead of crushing columns down to a character or two
  // per line (see the .table-scroll rule in markdown.css for why that
  // crushing was causing garbled, letter-spaced text).
  const TableRenderer = ({ children, ...props }) => (
    <div className="table-scroll">
      <table {...props}>{children}</table>
    </div>
  );

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
          {isEditing ? (
            <div className="edit-message-form">
              <textarea
                className="edit-message-textarea"
                value={draftText}
                autoFocus
                rows={1}
                onChange={(e) => {
                  setDraftText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onKeyDown={handleEditKeyDown}
                onFocus={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
              />

              <div className="edit-message-actions">
                <button
                  type="button"
                  className="edit-cancel-btn"
                  onClick={cancelEditing}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="edit-save-btn"
                  onClick={saveEdit}
                >
                  Save & Submit
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeHighlight]}
                  components={{
                    a: LinkRenderer,
                    table: TableRenderer,
                  }}
                >
                  {cleanedText}
                </ReactMarkdown>
              </div>

              {currentImages.length > 0 && (
                <ImageGallery images={currentImages} />
              )}
            </>
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

        {!isEditing && (
          <div className="message-actions">
            {/* Version Pagination Toggle (< 1 / 2 >) */}
            {sender === "ai" && versions.length > 1 && (
              <div className="version-pagination">
                <button
                  onClick={() => setVersionIdx((p) => Math.max(0, p - 1))}
                  disabled={versionIdx === 0}
                  title="Previous version"
                >
                  <FiChevronLeft size={15} />
                </button>
                <span>
                  {versionIdx + 1}/{versions.length}
                </span>
                <button
                  onClick={() => setVersionIdx((p) => Math.min(versions.length - 1, p + 1))}
                  disabled={versionIdx === versions.length - 1}
                  title="Next version"
                >
                  <FiChevronRight size={15} />
                </button>
              </div>
            )}

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
              <button onClick={startEditing} title="Edit message">
                <FiEdit2 size={16} />
              </button>
            ) : (
              <>
                {!isStreaming && (
                  <button
                    className="download-btn"
                    onClick={downloadPDF}
                    disabled={isDownloading}
                    title="Download as PDF"
                  >
                    {isDownloading ? (
                      <FiLoader size={16} className="spin-icon" />
                    ) : (
                      <FiDownload size={16} />
                    )}
                  </button>
                )}

                {!isStreaming && (
                  <div className="regen-dropdown-container" ref={regenMenuRef}>
                    <button
                      onClick={() => setShowRegenMenu((prev) => !prev)}
                      title="Regenerate options"
                      className={showRegenMenu ? "regen-btn active" : "regen-btn"}
                    >
                      <FiRefreshCw size={16} />
                    </button>

                    {showRegenMenu && (
                      <div className="regen-dropdown-menu">
                        <button
                          onClick={() => {
                            setShowRegenMenu(false);
                            onRegenerate?.(id, "both");
                          }}
                        >
                          <span>🔄</span> Regenerate Both
                        </button>
                        <button
                          onClick={() => {
                            setShowRegenMenu(false);
                            onRegenerate?.(id, "essay");
                          }}
                        >
                          <span>📝</span> Regenerate Essay
                        </button>
                        <button
                          onClick={() => {
                            setShowRegenMenu(false);
                            onRegenerate?.(id, "images");
                          }}
                        >
                          <span>🖼️</span> Regenerate Images
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  className={liked ? "feedback-btn active" : "feedback-btn"}
                  onClick={() => onFeedback?.(id, "like")}
                  title="Good response"
                >
                  {liked ? <FaThumbsUp size={15} /> : <FiThumbsUp size={16} />}
                </button>

                <button
                  className={disliked ? "feedback-btn active" : "feedback-btn"}
                  onClick={() => onFeedback?.(id, "dislike")}
                  title="Bad response"
                >
                  {disliked ? <FaThumbsDown size={15} /> : <FiThumbsDown size={16} />}
                </button>
              </>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default MessageBubble;