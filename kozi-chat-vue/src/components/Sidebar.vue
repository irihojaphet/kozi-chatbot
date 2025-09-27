<template>
  <div class="sidebar">
    <!-- Sidebar Header -->
    <div class="sidebar-header">
      <h2>Chats</h2>
      <button class="menu-toggle" @click="handleToggle">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- New Chat Button -->
    <button class="new-chat-btn" @click="handleNewChat">
      <i class="fas fa-plus"></i>
      New Chat
    </button>

    <!-- Chat History Section -->
    <div class="chat-history">
      <div class="history-controls">
        <div class="history-header">HISTORY</div>
        
        <!-- Clear All History Button -->
        <button 
          v-if="history.length > 0"
          :class="['clear-history-btn', { 'confirm': showClearConfirm }]"
          @click="handleClearAll"
          :title="showClearConfirm ? 'Click again to confirm' : 'Clear all history'"
        >
          <i v-if="showClearConfirm" class="fas fa-exclamation-triangle"></i>
          <span v-if="showClearConfirm">Confirm?</span>
          <i v-else class="fas fa-trash-alt"></i>
        </button>
      </div>
      
      <!-- History Content -->
      <div class="history-content">
        <!-- Empty State -->
        <div v-if="history.length === 0" class="empty-history">
          <p>No chat history yet</p>
          <p class="subtext">Start a new conversation</p>
        </div>
        
        <!-- History Items -->
        <div 
          v-else
          v-for="(item, index) in history"
          :key="item.sessionId || index" 
          class="history-item"
          @click="handleHistoryClick(item)"
        >
          <div class="history-item-content">
            <div class="history-title">{{ item.title }}</div>
          </div>
          
          <!-- Delete Individual Chat Button -->
          <button 
            class="delete-chat-btn"
            @click.stop="handleDeleteClick(item.sessionId)"
            title="Delete this chat"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Define props
defineProps({
  history: {
    type: Array,
    default: () => []
  }
})

// Define events this component can emit
const emit = defineEmits([
  'new-chat',
  'toggle', 
  'load-history',
  'delete-history',
  'clear-history'
])

// Local state for clear confirmation
const showClearConfirm = ref(false)

// Event handlers
const handleNewChat = () => {
  emit('new-chat')
}

const handleToggle = () => {
  emit('toggle')
}

const handleHistoryClick = (historyItem) => {
  emit('load-history', historyItem)
}

const handleDeleteClick = (sessionId) => {
  // Event.stop prevents the parent click event from firing
  emit('delete-history', sessionId)
}

const handleClearAll = () => {
  if (showClearConfirm.value) {
    emit('clear-history')
    showClearConfirm.value = false
  } else {
    showClearConfirm.value = true
    // Auto-hide confirmation after 3 seconds
    setTimeout(() => {
      showClearConfirm.value = false
    }, 3000)
  }
}
</script>

<style scoped>
/* Component-specific styles can go here if needed */
/* Most styles will come from the global dashboard.css */
</style>