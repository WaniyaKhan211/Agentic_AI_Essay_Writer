function Header({ isSidebarOpen, setIsSidebarOpen }) {
  return (
    <header className="header">

      <button
        className="menu-btn"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        ☰
      </button>

      <div>
        <h2>Agentic AI Essay Writer</h2>
        <p>Ask anything and generate professional essays.</p>
      </div>

    </header>
  );
}

export default Header;