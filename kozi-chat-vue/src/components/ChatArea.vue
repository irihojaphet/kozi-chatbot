<template>
  <div class="chat-messages">
    <!-- Welcome Screen (always show when no user messages) -->
    <div v-if="!hasUserMessages" class="welcome-screen">
      <div class="welcome-content">
        <h1>Good to see you! What would you like to explore today?</h1>
        <p>I'm here to help you with everything related to Kozi platform</p>

        <div class="suggestion-cards">
          <div
            v-for="(suggestion, index) in suggestionCards"
            :key="index"
            class="suggestion-card"
            @click="handleSuggestionClick(suggestion.msg)"
          >
            <i :class="suggestion.icon"></i>
            <span>{{ suggestion.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat Messages -->
    <template v-else>
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`"
      >
        <div class="message-content">
          <!-- User messages: plain text -->
          <div v-if="message.sender === 'user'">
            {{ message.text }}
          </div>
          
          <!-- Bot messages: formatted HTML -->
          <div
            v-else
            class="formatted-content"
            v-html="message.text"
          ></div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="message bot-message">
        <div class="loading-message">
          <div class="loading-dots">
            <span class="loading-dot"></span>
            <span class="loading-dot"></span>
            <span class="loading-dot"></span>
          </div>
          <span class="loading-text">Kozi Agent is thinking...</span>
        </div>
      </div>

      <!-- Error State -->
      <div v-if="error" class="message bot-message">
        <div class="error-message">
          <div class="error-header">
            <i class="fas fa-exclamation-triangle error-icon"></i>
            <span>Oops! Something went wrong</span>
          </div>
          <p class="error-text">{{ error }}</p>
          <button class="retry-btn" @click="handleRetry">
            <i class="fas fa-redo"></i>
            Try Again
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Define props
const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  }
})

// Define events
const emit = defineEmits(['suggestion-click', 'retry'])

// Check if there are any user messages
const hasUserMessages = computed(() => {
  return props.messages.some(msg => msg.sender === 'user')
})

// Suggestion cards data
const suggestionCards = [
  { 
    icon: "fas fa-user", 
    text: "Complete Profile", 
    msg: "How do I complete my profile?" 
  },
  { 
    icon: "fas fa-file-alt", 
    text: "CV Writing Help", 
    msg: "Help me write a professional CV" 
  },
  { 
    icon: "fas fa-briefcase", 
    text: "Find Jobs", 
    msg: "How can I find and apply for jobs?" 
  },
  { 
    icon: "fas fa-upload", 
    text: "Upload Documents", 
    msg: "What documents do I need to upload?" 
  }
]

// Handle suggestion click
const handleSuggestionClick = (message) => {
  emit('suggestion-click', message)
}

// Handle retry
const handleRetry = () => {
  emit('retry')
}
</script>

<style scoped>
/* Component-specific styles are in dashboard.css */
</style>