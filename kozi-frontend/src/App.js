// src/App.js
import React, { useState } from 'react';
import './dashboard.css';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import ChatInput from './ChatInput';
import useKoziChat from './hooks/useKoziChat';

function App() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  
  const {
    state: { messages, history, loading, currentChatTitle },
    actions: { 
      startNewChat, 
      sendMessage, 
      sendSuggestion, 
      toggleTheme,
      loadChatHistory,
      deleteHistoryItem,
      clearAllHistory
    }
  } = useKoziChat();

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  return (
    <div className="app-container">
      {sidebarVisible && (
        <Sidebar 
          onNewChat={startNewChat} 
          history={history}
          onToggle={toggleSidebar}
          onLoadHistory={loadChatHistory}
          onDeleteHistory={deleteHistoryItem}
          onClearHistory={clearAllHistory}
        />
      )}

      <div className="main-chat">
        <div className="chat-header">
          <div className="header-left">
            {!sidebarVisible && (
              <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
                <i className="fas fa-bars"></i>
              </button>
            )}
            <div className="agent-info">
              <h3>Kozi AI Agent</h3>
              <div className="status-indicator">
                <span className="status-dot online"></span>
                <span>Online</span>
                {currentChatTitle && currentChatTitle !== 'New Chat' && (
                  <span className="current-chat-title">• {currentChatTitle}</span>
                )}
              </div>
            </div>
          </div>
          <button className="theme-toggle" onClick={toggleTheme}>
            <i className="fas fa-moon"></i>
          </button>
        </div>

        <ChatArea messages={messages} onSuggestionClick={sendSuggestion} />
        <ChatInput onSend={sendMessage} disabled={loading} />
      </div>
    </div>
  );
}

export default App;