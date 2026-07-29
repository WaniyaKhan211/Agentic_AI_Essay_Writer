import { FiPlus, FiMessageSquare, FiEdit3 } from "react-icons/fi";

function Sidebar({
  isOpen,
  conversations,
  currentConversation,
  setCurrentConversation,
  createNewChat,
}) {
  return (
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
            <span>{chat.title}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default Sidebar;