import React, { useState } from "react";

const Sidebar = ({ onNewChat, history, onToggle, onLoadHistory, onDeleteHistory, onClearHistory }) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleHistoryClick = (historyItem) => {
    onLoadHistory(historyItem);
  };

  const handleDeleteClick = (e, sessionId) => {
    e.stopPropagation(); // Prevent loading the chat
    onDeleteHistory(sessionId);
  };

  const handleClearAll = () => {
    if (showClearConfirm) {
      onClearHistory();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Chats</h2>
        <button className="menu-toggle" onClick={onToggle}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <button className="new-chat-btn" onClick={onNewChat}>
        <i className="fas fa-plus"></i>
        New Chat
      </button>

      <div className="chat-history">
        <div className="history-controls">
          <div className="history-header">HISTORY</div>
          {history.length > 0 && (
            <button 
              className={`clear-history-btn ${showClearConfirm ? 'confirm' : ''}`}
              onClick={handleClearAll}
              title={showClearConfirm ? 'Click again to confirm' : 'Clear all history'}
            >
              {showClearConfirm ? (
                <>
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>Confirm?</span>
                </>
              ) : (
                <i className="fas fa-trash-alt"></i>
              )}
            </button>
          )}
        </div>
        
        <div className="history-content">
          {history.length === 0 ? (
            <div className="empty-history">
              <p>No chat history yet</p>
              <p className="subtext">Start a new conversation</p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div 
                key={item.sessionId || idx} 
                className="history-item"
                onClick={() => handleHistoryClick(item)}
              >
                <div className="history-item-content">
                  <div className="history-title">{item.title}</div>
                </div>
                <button 
                  className="delete-chat-btn"
                  onClick={(e) => handleDeleteClick(e, item.sessionId)}
                  title="Delete this chat"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;