<template>
  <div class="chat-messages">
    <!-- Welcome Screen (when no messages) -->
    <div v-if="messages.length === 0" class="welcome-screen">
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
    <div
      v-else
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
  </div>
</template>

<script setup>
// Define props (equivalent to React props)
defineProps({
  messages: {
    type: Array,
    default: () => []
  }
})

// Define events that this component can emit
const emit = defineEmits(['suggestion-click'])

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

// Handle suggestion click (emit event to parent)
const handleSuggestionClick = (message) => {
  emit('suggestion-click', message)
}
</script>

<style scoped>
/* Component-specific styles can go here if needed */
/* Most styles will come from the global dashboard.css */
</style>