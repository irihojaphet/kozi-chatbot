// src/hooks/useKoziChat.js
import { useEffect, useState, useCallback } from 'react';
import { getOrCreateDemoUser, startSession, sendChatMessage, getChatHistory } from '../api';

export default function useKoziChat() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [chatStarted, setChatStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentChatTitle, setCurrentChatTitle] = useState('New Chat');

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('kozi-chat-history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.warn('Failed to load chat history:', e);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('kozi-chat-history', JSON.stringify(history));
    }
  }, [history]);

  // Initialize user on mount
  useEffect(() => {
    const initializeUser = async () => {
      try {
        setLoading(true);
        const user = await getOrCreateDemoUser();
        setCurrentUser(user);
        console.log('User initialized:', user);
      } catch (e) {
        console.error('Failed to initialize user:', e);
        setError('Failed to initialize. Please refresh the page.');
        setMessages([{ 
          sender: 'assistant', 
          text: 'Sorry, I had trouble connecting. Please refresh the page and try again.' 
        }]);
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  const addBotMessage = useCallback((text) => {
    setMessages(prev => [...prev, { sender: 'assistant', text: formatMessage(text) }]);
  }, []);

  const addUserMessage = useCallback((text) => {
    setMessages(prev => [...prev, { sender: 'user', text }]);
  }, []);

  // Generate smart title from first user message
  const generateChatTitle = useCallback((firstMessage) => {
    if (!firstMessage) return 'New Chat';
    
    // Clean and truncate the message
    let title = firstMessage.trim();
    
    // Remove common question words and clean up
    title = title.replace(/^(how|what|when|where|why|can|could|would|should|tell me|help me)\s+/i, '');
    
    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
    // Truncate if too long
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    return title || 'New Chat';
  }, []);

  // Save current chat to history
  const saveCurrentChatToHistory = useCallback(() => {
    if (!currentSession || messages.length === 0) return;

    const firstUserMessage = messages.find(m => m.sender === 'user')?.text;
    const finalTitle = firstUserMessage ? generateChatTitle(firstUserMessage) : currentChatTitle;
    
    // Get last message and clean it for preview
    const lastMessage = messages[messages.length - 1];
    const cleanLastMessage = lastMessage ? stripHtmlAndFormat(lastMessage.text) : '';
    
    const chatEntry = {
      sessionId: currentSession,
      title: finalTitle,
      date: new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      timestamp: Date.now(),
      messageCount: messages.length,
      lastMessage: cleanLastMessage.substring(0, 100)
    };

    setHistory(prev => {
      // Remove any existing entry with same sessionId
      const filtered = prev.filter(item => item.sessionId !== currentSession);
      // Add new entry at the beginning
      return [chatEntry, ...filtered].slice(0, 50); // Keep only last 50 chats
    });
  }, [currentSession, messages, currentChatTitle, generateChatTitle]);

  const startNewChat = useCallback(async () => {
    if (!currentUser) {
      console.warn('No user available for new chat');
      return;
    }

    // Save current chat to history before starting new one
    if (currentSession && messages.length > 0) {
      saveCurrentChatToHistory();
    }

    // Reset chat state
    setMessages([]);
    setCurrentSession(null);
    setChatStarted(false);
    setError(null);
    setCurrentChatTitle('New Chat');
    setLoading(true);

    try {
      const data = await startSession(currentUser.user_id);
      console.log('Session started:', data);
      
      if (data?.success && data?.data) {
        setCurrentSession(data.data.session_id);
        setChatStarted(true);
        
        if (data.data.message) {
          addBotMessage(data.data.message);
        }
      } else {
        throw new Error('Invalid session response');
      }
    } catch (e) {
      console.error('Failed to start session:', e);
      setError('Failed to start chat session');
      addBotMessage('Sorry, I had trouble starting our chat. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, currentSession, messages, addBotMessage, saveCurrentChatToHistory]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !currentUser || loading) {
      return;
    }

    console.log('Sending message:', text);

    // Auto-start chat if needed
    if (!chatStarted || !currentSession) {
      console.log('Auto-starting chat session...');
      try {
        setLoading(true);
        const data = await startSession(currentUser.user_id);
        
        if (data?.success && data?.data) {
          setCurrentSession(data.data.session_id);
          setChatStarted(true);
          
          // Add initial bot message if present
          if (data.data.message) {
            addBotMessage(data.data.message);
          }
        } else {
          throw new Error('Failed to start session');
        }
      } catch (e) {
        console.error('Auto-start failed:', e);
        addBotMessage('Sorry, I had trouble starting our chat. Please try the "New Chat" button.');
        setLoading(false);
        return;
      }
    }

    // Add user message to UI immediately
    addUserMessage(text);
    
    // Update chat title if this is the first message
    if (messages.length === 0 || (messages.length === 1 && messages[0].sender === 'assistant')) {
      const newTitle = generateChatTitle(text);
      setCurrentChatTitle(newTitle);
    }

    setLoading(true);
    setError(null);

    try {
      const sessionId = currentSession || (await startSession(currentUser.user_id)).data?.session_id;
      const resp = await sendChatMessage(sessionId, currentUser.user_id, text);
      console.log('Message response:', resp);
      
      if (resp?.success && resp?.data) {
        addBotMessage(resp.data.message || 'I received your message.');
      } else {
        throw new Error('Invalid message response');
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      setError('Failed to send message');
      addBotMessage('Sorry, I had trouble processing your message. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [chatStarted, currentSession, currentUser, loading, messages, addUserMessage, addBotMessage, generateChatTitle]);

  const sendSuggestion = useCallback(async (text) => {
    await sendMessage(text);
  }, [sendMessage]);

  const loadChatHistory = useCallback(async (historyItem) => {
    if (!historyItem.sessionId) return;
    
    // Save current chat before loading new one
    if (currentSession && messages.length > 0) {
      saveCurrentChatToHistory();
    }
    
    setLoading(true);
    try {
      const data = await getChatHistory(historyItem.sessionId);
      console.log('Loaded history:', data);
      
      if (data?.success && data?.data?.messages) {
        const msgs = data.data.messages.map(m => ({
          sender: m.sender === 'user' ? 'user' : 'assistant',
          text: formatMessage(m.message || m.text || '')
        }));
        setMessages(msgs);
        setCurrentSession(historyItem.sessionId);
        setCurrentChatTitle(historyItem.title);
        setChatStarted(true);
      } else {
        // If backend history fails, show local history info
        setMessages([
          { sender: 'assistant', text: `Loaded chat: ${historyItem.title}` },
          { sender: 'assistant', text: 'Previous messages from this session are not available.' }
        ]);
        setCurrentChatTitle(historyItem.title);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
      addBotMessage('Failed to load chat history.');
    } finally {
      setLoading(false);
    }
  }, [addBotMessage, currentSession, messages, saveCurrentChatToHistory]);

  const deleteHistoryItem = useCallback((sessionId) => {
    setHistory(prev => prev.filter(item => item.sessionId !== sessionId));
  }, []);

  const clearAllHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('kozi-chat-history');
  }, []);

  const toggleTheme = useCallback(() => {
    document.body.classList.toggle('dark');
  }, []);

  // Auto-save current chat when component unmounts or page closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSession && messages.length > 0) {
        saveCurrentChatToHistory();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload(); // Save on unmount
    };
  }, [currentSession, messages, saveCurrentChatToHistory]);

  return {
    state: {
      currentUser,
      currentSession,
      messages,
      history,
      chatStarted,
      loading,
      error,
      currentChatTitle
    },
    actions: {
      startNewChat,
      sendMessage,
      sendSuggestion,
      loadChatHistory,
      deleteHistoryItem,
      clearAllHistory,
      toggleTheme
    }
  };
}

// Utility functions
function stripHtmlAndFormat(text = '') {
  if (!text) return '';
  
  // Remove HTML tags
  let cleaned = text.replace(/<[^>]*>/g, '');
  
  // Remove markdown formatting
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1'); // Bold
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1'); // Italic
  cleaned = cleaned.replace(/#{1,6}\s*(.+)/g, '$1'); // Headers
  cleaned = cleaned.replace(/^\d+\.\s*/gm, ''); // Numbered lists
  cleaned = cleaned.replace(/^[-•]\s*/gm, ''); // Bullet points
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

function formatMessage(message = '') {
  if (!message) return '';
  
  let formatted = String(message);
  
  // Remove unwanted markdown characters at the start of lines
  formatted = formatted.replace(/^[#*><]+\s*/gm, '');
  
  // Handle numbered lists
  formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="numbered-item"><span class="number">$1.</span>$2</div>');
  
  // Handle bullet points
  formatted = formatted.replace(/^\s*[-•]\s+(.+)$/gm, '<div class="bullet-item">$1</div>');
  
  // Handle bold text
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Handle section headers
  formatted = formatted.replace(/^(.+):$/gm, '<div class="section-header">$1</div>');
  
  // Convert line breaks
  formatted = formatted.replace(/\n\n/g, '</p><p>');
  formatted = formatted.replace(/\n/g, '<br>');
  
  // Wrap in paragraph tags if not already wrapped
  if (!formatted.includes('<div') && !formatted.includes('<p>')) {
    formatted = `<p>${formatted}</p>`;
  }
  
  return formatted;
}