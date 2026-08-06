import { useState } from "react";
import { FiMessageSquare, FiEdit3, FiMoreHorizontal } from "react-icons/fi";

function DeleteModal({ chat, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Delete chat?</h2>
        <p className="modal-body">
          This will permanently delete{" "}
          <strong>&ldquo;{chat.title}&rdquo;</strong>.
        </p>
        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-btn delete" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  isOpen,
  conversations,
  currentConversation,
  setCurrentConversation,
  createNewChat,
  onDeleteChat,
}) {
  const [pendingDelete, setPendingDelete] = useState(null); // { id, title }

  const handleDeleteConfirm = async () => {
    if (pendingDelete) {
      await onDeleteChat(pendingDelete.id);
      setPendingDelete(null);
    }
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <button className="new-chat-btn" onClick={createNewChat}>
          <FiEdit3 size={18} />
          <span>New Chat</span>
        </button>

        <div className="history">
          <h3>Recent Chats</h3>

          {conversations.map((chat) => (
            <div
              key={chat.id}
              className={`history-item ${
                currentConversation === chat.id ? "active" : ""
              }`}
              onClick={() => setCurrentConversation(chat.id)}
            >
              <FiMessageSquare size={18} />
              <span className="history-item-title">{chat.title}</span>
              <button
                className="more-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete({ id: chat.id, title: chat.title });
                }}
              >
                <FiMoreHorizontal size={15} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {pendingDelete && (
        <DeleteModal
          chat={pendingDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}

export default Sidebar;