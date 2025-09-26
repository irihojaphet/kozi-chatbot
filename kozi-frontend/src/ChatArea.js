import React from "react";

const ChatArea = ({ messages, onSuggestionClick }) => {
  // Function to render formatted message content
  const renderMessageContent = (content) => {
    return (
      <div 
        className="formatted-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  };

  return (
    <div className="chat-messages">
      {messages.length === 0 ? (
        <div className="welcome-screen">
          <div className="welcome-content">
            <h1>Good to see you! What would you like to explore today?</h1>
            <p>I'm here to help you with everything related to Kozi platform</p>

            <div className="suggestion-cards">
              {[
                { icon: "fas fa-user", text: "Complete Profile", msg: "How do I complete my profile?" },
                { icon: "fas fa-file-alt", text: "CV Writing Help", msg: "Help me write a professional CV" },
                { icon: "fas fa-briefcase", text: "Find Jobs", msg: "How can I find and apply for jobs?" },
                { icon: "fas fa-upload", text: "Upload Documents", msg: "What documents do I need to upload?" }
              ].map((s, idx) => (
                <div
                  key={idx}
                  className="suggestion-card"
                  onClick={() => onSuggestionClick(s.msg)}
                >
                  <i className={s.icon}></i>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        messages.map((m, idx) => (
          <div
            key={idx}
            className={`message ${m.sender === "user" ? "user-message" : "bot-message"}`}
          >
            <div className="message-content">
              {m.sender === "user" ? (
                // User messages render as plain text
                <div>{m.text}</div>
              ) : (
                // Bot messages render with HTML formatting
                renderMessageContent(m.text)
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ChatArea;