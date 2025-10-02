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

  // Helper: push bot message with support for jobs payload
  // Replace your addBotMessage with this version
const addBotMessage = (payload) => {
  // Case 1: plain string from server → format to HTML
  if (typeof payload === 'string') {
    messages.value.push({ sender: 'bot', text: formatMessage(payload) })
    return
  }

  // Case 2: object (possibly from formatMessage(message, rawData))
  if (payload && typeof payload === 'object') {
    // If it already looks preformatted (has jobs OR contains HTML tags), don't re-format
    const looksPreformatted =
      Array.isArray(payload.jobs) ||
      (typeof payload.text === 'string' && /<\/?[a-z][\s\S]*>/i.test(payload.text))

    const text = typeof payload.text === 'string'
      ? (looksPreformatted ? payload.text : formatMessage(payload.text))
      : formatMessage('')

    const msg = { sender: 'bot', text }

    // Preserve jobs array if present
    if (Array.isArray(payload.jobs) && payload.jobs.length) {
      msg.jobs = payload.jobs
    }

    messages.value.push(msg)
    return
  }

  // Fallback
  messages.value.push({ sender: 'bot', text: formatMessage('') })
}

// (unchanged)
const addUserMessage = (text) => {
  messages.value.push({ sender: 'user', text })
}

// (unchanged)
const generateChatTitle = (firstMessage) => {
  if (!firstMessage) return 'New Chat'
  let title = firstMessage.trim()
  title = title.replace(/^(how|what|when|where|why|can|could|would|should|tell me|help me)\s+/i, '')
  title = title.charAt(0).toUpperCase() + title.slice(1)
  if (title.length > 50) title = title.substring(0, 47) + '...'
  return title || 'New Chat'
}

// (unchanged logic; works with 'bot')
const saveCurrentChatToHistory = () => {
  if (!currentSession.value || messages.value.length === 0) return
  const firstUserMessage = messages.value.find(m => m.sender === 'user')?.text
  const finalTitle = firstUserMessage ? generateChatTitle(firstUserMessage) : currentChatTitle.value

  const lastMessage = messages.value[messages.value.length - 1]
  let cleanLastMessage = ''
  if (lastMessage) {
    cleanLastMessage = lastMessage.sender === 'user'
      ? lastMessage.text
      : stripHtmlAndFormat(lastMessage.text)
  }

  const chatEntry = {
    sessionId: currentSession.value,
    title: finalTitle,
    date: new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }),
    timestamp: Date.now(),
    messageCount: messages.value.length,
    lastMessage: cleanLastMessage.substring(0, 100)
  }

  const filtered = history.value.filter(item => item.sessionId !== currentSession.value)
  history.value = [chatEntry, ...filtered].slice(0, 50)
}

// (no functional change; shown for context)
const startNewChat = async () => {
  if (!currentUser.value) {
    console.warn('No user available for new chat')
    return
  }

  if (currentSession.value && messages.value.length > 0) {
    saveCurrentChatToHistory()
  }

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
        // welcome message (plain string) → handled by addBotMessage
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
        // === IMPORTANT ===
        // Use the full payload so job cards render when backend responds with:
        // { message, intent: 'jobs', context: { last_jobs: [...] } }
        const formatted = formatMessage(resp.data.message || 'I received your message.', resp.data)
        addBotMessage(formatted)
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
        const msgs = data.data.messages.map(m => {
          // If your history endpoint also returns intent/context for each bot message,
          // pass them into formatMessage to restore job cards from history as well.
          if (m.sender === 'user') {
            return { sender: 'user', text: m.message || m.text || '' }
          } else {
            const fmtd = formatMessage(m.message || m.text || '', m)
            return (typeof fmtd === 'string')
              ? { sender: 'assistant', text: fmtd }
              : { sender: 'assistant', text: fmtd.text, jobs: fmtd.jobs }
          }
        })
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

/* ---------------------------------- */
/* Utility + Formatting               */
/* ---------------------------------- */
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

/**
 * Job-aware formatter.
 * - If rawData.intent === 'jobs', returns { text, jobs } so ChatArea can render <JobCard />
 * - Otherwise returns formatted HTML string.
 */
function formatMessage(message = '', rawData = null) {
  if (!message) return ''

  // === Jobs intent handling ===
  if (rawData && rawData.intent === 'jobs') {
    const jobsContext = rawData.context?.last_jobs || []
    return {
      text: formatMessageText(message),
      jobs: Array.isArray(jobsContext) ? jobsContext : [],
      type: 'jobs'
    }
  }

  // Regular text
  return formatMessageText(message)
}

function formatMessageText(message) {
  let formatted = String(message)

  // Remove markdown artifacts from start of lines
  formatted = formatted.replace(/^[#*><]+\s*/gm, '')

  // Section headers (lines ending with colon)
  formatted = formatted.replace(/^([^:\n]+):$/gm, '<div class="section-header">$1</div>')

  // Numbered lists
  formatted = formatted.replace(
    /^(\d+)\.\s+(.+)$/gm,
    '<div class="numbered-item"><span class="number">$1.</span><span class="text">$2</span></div>'
  )

  // Bullets
  formatted = formatted.replace(/^\s*[-•]\s+(.+)$/gm, '<div class="bullet-item">$1</div>')

  // Bold (**text** or __text__)
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>')

  // Italic (*text* or _text_) (avoid bold)
  formatted = formatted.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
  formatted = formatted.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>')

  // Paragraphs
  formatted = formatted.replace(/\n\n/g, '</p><p>')
  formatted = formatted.replace(/\n/g, '<br>')

  if (!formatted.includes('<div') && !formatted.includes('<p>')) {
    formatted = `<p>${formatted}</p>`
  }

  // Remove empty paragraphs
  formatted = formatted.replace(/<p>\s*<\/p>/g, '')
  return formatted
}

// Alternative helper if headers are very long
function formatMessageWithLongHeaders(message = '', rawData = null) {
  const formatted = formatMessage(message, rawData)
  if (typeof formatted === 'string') {
    return formatted.replace(
      /<div class="section-header">([^<]{50,})<\/div>/g,
      '<div class="section-header allow-wrap">$1</div>'
    )
  }
  // If it's a jobs payload, just wrap the text part
  return {
    ...formatted,
    text: formatted.text.replace(
      /<div class="section-header">([^<]{50,})<\/div>/g,
      '<div class="section-header allow-wrap">$1</div>'
    )
  }
}

// Export helpers if needed elsewhere
export { formatMessage, formatMessageWithLongHeaders }
