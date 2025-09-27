<template>
  <div class="app-container">
    <!-- Sidebar - conditionally rendered -->
    <Sidebar 
      v-if="sidebarVisible"
      :history="history"
      @new-chat="startNewChat" 
      @toggle="toggleSidebar"
      @load-history="loadChatHistory"
      @delete-history="deleteHistoryItem"
      @clear-history="clearAllHistory"
    />

    <!-- Main Chat Area -->
    <div class="main-chat">
      <!-- Chat Header -->
      <div class="chat-header">
        <div class="header-left">
          <!-- Toggle button when sidebar is hidden -->
          <button 
            v-if="!sidebarVisible"
            class="sidebar-toggle-btn" 
            @click="toggleSidebar"
          >
            <i class="fas fa-bars"></i>
          </button>
          
          <div class="agent-info">
            <h3>Kozi AI Agent</h3>
            <div class="status-indicator">
              <span class="status-dot online"></span>
              <span>Online</span>
              <!-- Show current chat title if available -->
              <span 
                v-if="currentChatTitle && currentChatTitle !== 'New Chat'" 
                class="current-chat-title"
              >
                • {{ currentChatTitle }}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Theme toggle button -->
        <button class="theme-toggle" @click="toggleTheme">
          <i class="fas fa-moon"></i>
        </button>
      </div>

      <!-- Chat Messages Area -->
      <ChatArea 
        :messages="messages" 
        @suggestion-click="sendSuggestion" 
      />
      
      <!-- Chat Input -->
      <ChatInput 
        :disabled="loading" 
        @send="sendMessage" 
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import ChatArea from './components/ChatArea.vue'
import ChatInput from './components/ChatInput.vue'
import { useKoziChat } from './composables/useKoziChat'

// Local component state for sidebar visibility
const sidebarVisible = ref(true)

// Use our chat composable (equivalent to React custom hook)
const {
  // State
  messages,
  history,
  loading,
  currentChatTitle,
  
  // Actions
  startNewChat,
  sendMessage,
  sendSuggestion,
  toggleTheme,
  loadChatHistory,
  deleteHistoryItem,
  clearAllHistory
} = useKoziChat()

// Sidebar toggle functionality
const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}
</script>

<style>
/* Import our polished CSS */
@import './assets/dashboard.css';

/* FontAwesome icons */
@import '@fortawesome/fontawesome-free/css/all.css';
</style>