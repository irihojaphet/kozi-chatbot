// Demo User Configuration
const DEMO_CONFIG = {
    baseURL: '/api',
    demoUser: {
        email: 'demo@kozi.rw',
        user_type: 'employee'
    }
};

// Global State
let currentUser = null;
let currentSession = null;
let chatInitialized = false;
let chatStarted = false;

// Initialize Dashboard on page load
document.addEventListener('DOMContentLoaded', async () => {
    await initializeDemo();
    setupEventListeners();
});

// Initialize Demo User and Chat
async function initializeDemo() {
    try {
        // Create or get demo user
        currentUser = await getOrCreateDemoUser();

        // Initialize chat service (but don't start session yet)
        chatInitialized = true;
        enableChat();

    } catch (error) {
        console.error('Demo initialization failed:', error);
        showError('Failed to initialize. Please refresh the page.');
    }
}

// Create or retrieve demo user
async function getOrCreateDemoUser() {
    try {
        // Try to get existing user
        const response = await fetch(`${DEMO_CONFIG.baseURL}/profile/user/${DEMO_CONFIG.demoUser.email}`);
        if (response.ok) {
            const data = await response.json();
            return data.data;
        }

        // Create new user
        const createResponse = await fetch(`${DEMO_CONFIG.baseURL}/profile/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(DEMO_CONFIG.demoUser)
        });

        const createData = await createResponse.json();
        return createData.data;

    } catch (error) {
        console.error('Failed to get/create user:', error);
        throw error;
    }
}

// Start a new chat session
async function startNewChat() {
    try {
        // Clear previous chat
        clearChat();

        // Start new session
        const response = await fetch(`${DEMO_CONFIG.baseURL}/chat/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.user_id })
        });

        const data = await response.json();

        if (data.success) {
            currentSession = data.data.session_id;
            addBotMessage(data.data.message);
            chatStarted = true;
            hideWelcomeScreen();
            
            // ADDED: Add to chat history
            addToChatHistory(currentSession, `Chat ${new Date().toLocaleTimeString()}`);
        }

    } catch (error) {
        console.error('Failed to start chat session:', error);
        addBotMessage('Sorry, I had trouble starting our chat. Please refresh the page.');
    }
}

// Send message to chat
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message || !chatInitialized) return;

    // Start chat if not started
    if (!chatStarted) {
        await startNewChat();
    }

    // Add user message to UI
    addUserMessage(message);
    messageInput.value = '';

    // Hide welcome screen if still visible
    hideWelcomeScreen();

    // Update chat history title with first user message
    if (currentSession) {
        updateChatHistoryTitle(currentSession, message);
    }

    // Disable input while processing
    disableChat();

    try {
        const response = await fetch(`${DEMO_CONFIG.baseURL}/chat/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSession,
                user_id: currentUser.user_id,
                message: message
            })
        });

        const data = await response.json();

        if (data.success) {
            addBotMessage(data.data.message);
        } else {
            addBotMessage('Sorry, I had trouble processing your message. Please try again.');
        }

    } catch (error) {
        console.error('Failed to send message:', error);
        addBotMessage('Sorry, there was an error. Please try again.');
    } finally {
        enableChat();
    }
}

// Send suggestion message
async function sendSuggestion(message) {
    if (!chatInitialized) return;

    // Set the message and send it
    document.getElementById('messageInput').value = message;
    await sendMessage();
}

// UI Helper Functions
function clearChat() {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    chatStarted = false;
    showWelcomeScreen();
}

function showWelcomeScreen() {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = `
        <div class="welcome-screen">
            <div class="welcome-content">
                <h1>Good to see you! What would you like to explore today?</h1>
                <p>I'm here to help you with everything related to Kozi platform</p>
                
                <div class="suggestion-cards">
                    <div class="suggestion-card" data-message="How do I complete my profile?">
                        <i class="fas fa-user"></i>
                        <span>Complete Profile</span>
                    </div>
                    <div class="suggestion-card" data-message="Help me write a professional CV">
                        <i class="fas fa-file-alt"></i>
                        <span>CV Writing Help</span>
                    </div>
                    <div class="suggestion-card" data-message="How can I find and apply for jobs?">
                        <i class="fas fa-briefcase"></i>
                        <span>Find Jobs</span>
                    </div>
                    <div class="suggestion-card" data-message="What documents do I need to upload?">
                        <i class="fas fa-upload"></i>
                        <span>Upload Documents</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Bind click handlers for newly rendered suggestion cards (no inline handlers)
    bindSuggestionCardClicks();
}

function hideWelcomeScreen() {
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
}

function addBotMessage(message) {
    const messagesContainer = document.getElementById('chatMessages');

    // Remove welcome screen if present
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    
    // Format the message to handle markdown and improve readability
    const formattedMessage = formatMessage(message);
    messageDiv.innerHTML = `<div class="message-content">${formattedMessage}</div>`;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addUserMessage(message) {
    const messagesContainer = document.getElementById('chatMessages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `<div class="message-content">${message}</div>`;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showError(message) {
    addBotMessage(`❌ ${message}`);
}

function enableChat() {
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
}

function disableChat() {
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendBtn').disabled = true;
}

// Theme toggle functionality
function toggleTheme() {
    document.body.classList.toggle('dark');
    const themeIcon = document.querySelector('.theme-toggle i');

    if (document.body.classList.contains('dark')) {
        themeIcon.className = 'fas fa-sun';
    } else {
        themeIcon.className = 'fas fa-moon';
    }
}

// Event Listeners
function setupEventListeners() {
    // Enter key for sending messages
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send button (no inline)
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // Theme toggle (no inline)
    const themeToggleBtn = document.querySelector('.theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // New chat (no inline)
    const newChatBtn = document.querySelector('.new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewChat);
    }

    // Mobile sidebar toggle (for responsive)
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Bind suggestion cards present in initial DOM (no inline)
    bindSuggestionCardClicks();
}

// Bind clicks for any .suggestion-card with data-message
function bindSuggestionCardClicks() {
    document.querySelectorAll('.suggestion-card[data-message]').forEach(card => {
        card.addEventListener('click', () => {
            const msg = card.getAttribute('data-message');
            if (msg) sendSuggestion(msg);
        });
    });
}

// Utility function to format messages with markdown support
function formatMessage(message) {
    if (!message) return '';

    let m = String(message).replace(/\r\n/g, '\n'); // normalize line endings

    // 1) Convert Markdown headings to bold (remove leading ### etc.)
    //    Matches lines starting with 1–6 hashes.
    m = m.replace(/^#{1,6}\s*(.+)$/gm, '<strong>$1</strong>');

    // 2) Bullet lists: "- text" or "* text" -> a styled row
    m = m.replace(/^[\-\*]\s+(.+)$/gm, '<div class="chat-step">• $1</div>');

    // 3) Numbered lists: "1. text" -> number in bold + text
    m = m.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="chat-step"><strong>$1.</strong> $2</div>');

    // 4) Bold: **text** -> <strong>text</strong>
    m = m.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 5) Remaining newlines -> <br> (after list/heading transforms)
    m = m.replace(/\n/g, '<br>');

    return m;
}


// Add chat history management with smart naming
function addToChatHistory(sessionId, title) {
    const historyContent = document.getElementById('chatHistory');
    const emptyHistory = historyContent.querySelector('.empty-history');

    if (emptyHistory) {
        emptyHistory.remove();
    }

    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <div class="history-title">${title}</div>
        <div class="history-date">${new Date().toLocaleDateString()}</div>
    `;

    historyItem.onclick = () => {
        loadChatHistory(sessionId);
    };

    historyContent.appendChild(historyItem);
}

// Update chat history title based on user's first message
function updateChatHistoryTitle(sessionId, userMessage) {
    const historyItems = document.querySelectorAll('.history-item');
    historyItems.forEach(item => {
        const titleElement = item.querySelector('.history-title');
        if (titleElement && titleElement.textContent.startsWith('Chat ')) {
            // Generate smart title from user message (first 30 chars)
            const smartTitle = userMessage.length > 30 
                ? userMessage.substring(0, 30) + '...'
                : userMessage;
            titleElement.textContent = smartTitle;
        }
    });
}

// Load previous chat session (for future enhancement)
async function loadChatHistory(sessionId) {
    try {
        const response = await fetch(`${DEMO_CONFIG.baseURL}/chat/history/${sessionId}`);
        const data = await response.json();

        if (data.success) {
            // Clear current chat and load history
            clearChat();
            data.data.messages.forEach(msg => {
                if (msg.sender === 'user') {
                    addUserMessage(msg.message);
                } else {
                    addBotMessage(msg.message);
                }
            });

            currentSession = sessionId;
            chatStarted = true;
            hideWelcomeScreen();
        }
    } catch (error) {
        console.error('Failed to load chat history:', error);
    }
}