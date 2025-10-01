// src/composables/useKoziChat.js
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getOrCreateDemoUser, startSession, sendChatMessage, getChatHistory } from '../services/api'

export function useKoziChat() {
  // Reactive state
  const currentUser = ref(null)
  const currentSession = ref(null)
  const messages = ref([])
  const history = ref([])
  const chatStarted = ref(false)
  const loading = ref(false)
  const error = ref(null)
  const currentChatTitle = ref('New Chat')
  const lastFailedMessage = ref(null) // Store failed message for retry

  // Load history from localStorage on mount
  onMounted(() => {
    const savedHistory = localStorage.getItem('kozi-chat-history')
    if (savedHistory) {
      try {
        history.value = JSON.parse(savedHistory)
      } catch (e) {
        console.warn('Failed to load chat history:', e)
      }
    }
    initializeUser()
  })

  // Watch history changes and save to localStorage
  watch(history, (newHistory) => {
    if (newHistory.length > 0) {
      localStorage.setItem('kozi-chat-history', JSON.stringify(newHistory))
    }
  }, { deep: true })

  // Initialize user
  const initializeUser = async () => {
    try {
      loading.value = true
      error.value = null
      const user = await getOrCreateDemoUser()
      currentUser.value = user
      console.log('User initialized:', user)
    } catch (e) {
      console.error('Failed to initialize user:', e)
      error.value = 'Failed to connect to Kozi. Please refresh the page.'
      messages.value = [{ 
        sender: 'assistant', 
        text: 'Sorry, I had trouble connecting. Please refresh the page and try again.' 
      }]
    } finally {
      loading.value = false
    }
  }

  // Helper functions
  const addBotMessage = (text) => {
    messages.value.push({ sender: 'assistant', text: formatMessage(text) })
  }

  const addUserMessage = (text) => {
    messages.value.push({ sender: 'user', text })
  }

  // Generate smart title from first user message
  const generateChatTitle = (firstMessage) => {
    if (!firstMessage) return 'New Chat'
    
    let title = firstMessage.trim()
    title = title.replace(/^(how|what|when|where|why|can|could|would|should|tell me|help me)\s+/i, '')
    title = title.charAt(0).toUpperCase() + title.slice(1)
    
    if (title.length > 50) {
      title = title.substring(0, 47) + '...'
    }
    
    return title || 'New Chat'
  }

  // Save current chat to history
  const saveCurrentChatToHistory = () => {
    if (!currentSession.value || messages.value.length === 0) return

    const firstUserMessage = messages.value.find(m => m.sender === 'user')?.text
    const finalTitle = firstUserMessage ? generateChatTitle(firstUserMessage) : currentChatTitle.value
    
    const lastMessage = messages.value[messages.value.length - 1]
    let cleanLastMessage = ''
    
    if (lastMessage) {
      if (lastMessage.sender === 'user') {
        cleanLastMessage = lastMessage.text
      } else {
        cleanLastMessage = stripHtmlAndFormat(lastMessage.text)
      }
    }
    
    const chatEntry = {
      sessionId: currentSession.value,
      title: finalTitle,
      date: new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      timestamp: Date.now(),
      messageCount: messages.value.length,
      lastMessage: cleanLastMessage.substring(0, 100)
    }

    const filtered = history.value.filter(item => item.sessionId !== currentSession.value)
    history.value = [chatEntry, ...filtered].slice(0, 50)
  }

  // Start new chat
  const startNewChat = async () => {
    if (!currentUser.value) {
      console.warn('No user available for new chat')
      return
    }

    // Save current chat to history before starting new one
    if (currentSession.value && messages.value.length > 0) {
      saveCurrentChatToHistory()
    }

    // Reset chat state
    messages.value = []
    currentSession.value = null
    chatStarted.value = false
    error.value = null
    currentChatTitle.value = 'New Chat'
    lastFailedMessage.value = null
    loading.value = true

    try {
      const data = await startSession(currentUser.value.user_id)
      console.log('Session started:', data)
      
      if (data?.success && data?.data) {
        currentSession.value = data.data.session_id
        chatStarted.value = true
        
        if (data.data.message) {
          addBotMessage(data.data.message)
        }
      } else {
        throw new Error('Invalid session response')
      }
    } catch (e) {
      console.error('Failed to start session:', e)
      error.value = 'Failed to start chat session. Please try again.'
    } finally {
      loading.value = false
    }
  }

  // Send message
  const sendMessage = async (text) => {
    if (!text.trim() || !currentUser.value || loading.value) {
      return
    }

    console.log('Sending message:', text)
    
    // Clear any previous errors
    error.value = null
    lastFailedMessage.value = null

    // Auto-start chat if needed
    if (!chatStarted.value || !currentSession.value) {
      console.log('Auto-starting chat session...')
      try {
        loading.value = true
        const data = await startSession(currentUser.value.user_id)
        
        if (data?.success && data?.data) {
          currentSession.value = data.data.session_id
          chatStarted.value = true
          
          if (data.data.message) {
            addBotMessage(data.data.message)
          }
        } else {
          throw new Error('Failed to start session')
        }
      } catch (e) {
        console.error('Auto-start failed:', e)
        error.value = 'Failed to start chat session. Please try the "New Chat" button.'
        loading.value = false
        return
      }
    }

    // Add user message to UI immediately
    addUserMessage(text)
    
    // Update chat title if this is the first message
    if (messages.value.length === 1 || (messages.value.length === 2 && messages.value[0].sender === 'assistant')) {
      const newTitle = generateChatTitle(text)
      currentChatTitle.value = newTitle
    }

    loading.value = true

    try {
      const sessionId = currentSession.value || (await startSession(currentUser.value.user_id)).data?.session_id
      const resp = await sendChatMessage(sessionId, currentUser.value.user_id, text)
      console.log('Message response:', resp)
      
      if (resp?.success && resp?.data) {
        addBotMessage(resp.data.message || 'I received your message.')
      } else {
        throw new Error('Invalid message response')
      }
    } catch (e) {
      console.error('Failed to send message:', e)
      error.value = 'Failed to send message. Please check your connection and try again.'
      lastFailedMessage.value = text // Store for retry
      
      // Remove the user message that failed
      messages.value = messages.value.filter(m => m.text !== text || m.sender !== 'user')
    } finally {
      loading.value = false
    }
  }

  // Retry last failed message
  const retryLastMessage = async () => {
    if (lastFailedMessage.value) {
      const messageToRetry = lastFailedMessage.value
      lastFailedMessage.value = null
      error.value = null
      await sendMessage(messageToRetry)
    }
  }

  // Send suggestion (same as send message)
  const sendSuggestion = async (text) => {
    await sendMessage(text)
  }

  // Load chat history
  const loadChatHistory = async (historyItem) => {
    if (!historyItem.sessionId) return
    
    // Save current chat before loading new one
    if (currentSession.value && messages.value.length > 0) {
      saveCurrentChatToHistory()
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await getChatHistory(historyItem.sessionId)
      console.log('Loaded history:', data)
      
      if (data?.success && data?.data?.messages) {
        const msgs = data.data.messages.map(m => ({
          sender: m.sender === 'user' ? 'user' : 'assistant',
          text: formatMessage(m.message || m.text || '')
        }))
        messages.value = msgs
        currentSession.value = historyItem.sessionId
        currentChatTitle.value = historyItem.title
        chatStarted.value = true
      } else {
        // If backend history fails, show local history info
        messages.value = [
          { sender: 'assistant', text: `Loaded chat: ${historyItem.title}` },
          { sender: 'assistant', text: 'Previous messages from this session are not available.' }
        ]
        currentChatTitle.value = historyItem.title
      }
    } catch (e) {
      console.error('Failed to load history:', e)
      error.value = 'Failed to load chat history. Please try again.'
    } finally {
      loading.value = false
    }
  }

  // Delete history item
  const deleteHistoryItem = (sessionId) => {
    history.value = history.value.filter(item => item.sessionId !== sessionId)
  }

  // Clear all history
  const clearAllHistory = () => {
    history.value = []
    localStorage.removeItem('kozi-chat-history')
  }

  // Toggle theme
  const toggleTheme = () => {
    document.body.classList.toggle('dark')
    
    // Save theme preference
    const isDark = document.body.classList.contains('dark')
    localStorage.setItem('kozi-theme', isDark ? 'dark' : 'light')
  }

  // Load theme preference on mount
  onMounted(() => {
    const savedTheme = localStorage.getItem('kozi-theme')
    if (savedTheme === 'dark') {
      document.body.classList.add('dark')
    }
  })

  // Auto-save current chat when component unmounts or page closes
  const handleBeforeUnload = () => {
    if (currentSession.value && messages.value.length > 0) {
      saveCurrentChatToHistory()
    }
  }

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
    handleBeforeUnload()
  })

  // Return reactive state and actions
  return {
    // State
    currentUser: computed(() => currentUser.value),
    currentSession: computed(() => currentSession.value),
    messages: computed(() => messages.value),
    history: computed(() => history.value),
    chatStarted: computed(() => chatStarted.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    currentChatTitle: computed(() => currentChatTitle.value),
    
    // Actions
    startNewChat,
    sendMessage,
    sendSuggestion,
    loadChatHistory,
    deleteHistoryItem,
    clearAllHistory,
    toggleTheme,
    retryLastMessage
  }
}

// Utility functions
function stripHtmlAndFormat(text = '') {
  if (!text) return ''
  
  let cleaned = text.replace(/<[^>]*>/g, '')
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1')
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1')
  cleaned = cleaned.replace(/#{1,6}\s*(.+)/g, '$1')
  cleaned = cleaned.replace(/^\d+\.\s*/gm, '')
  cleaned = cleaned.replace(/^[-•]\s*/gm, '')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
}

function formatMessage(message = '') {
  if (!message) return ''
  
  let formatted = String(message)
  
  formatted = formatted.replace(/^[#*><]+\s*/gm, '')
  formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="numbered-item"><span class="number">$1.</span>$2</div>')
  formatted = formatted.replace(/^\s*[-•]\s+(.+)$/gm, '<div class="bullet-item">$1</div>')
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/^(.+):$/gm, '<div class="section-header">$1</div>')
  formatted = formatted.replace(/\n\n/g, '</p><p>')
  formatted = formatted.replace(/\n/g, '<br>')
  
  if (!formatted.includes('<div') && !formatted.includes('<p>')) {
    formatted = `<p>${formatted}</p>`
  }
  
  return formatted
}