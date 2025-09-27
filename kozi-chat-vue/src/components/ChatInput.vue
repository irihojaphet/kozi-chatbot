<template>
  <div class="chat-input-container">
    <div class="chat-input">
      <input
        v-model="message"
        type="text"
        placeholder="Ask me anything about Kozi..."
        :disabled="disabled"
        @keypress="handleKeyPress"
        ref="inputRef"
      />
      <button 
        @click="handleSend"
        :disabled="disabled || !canSend"
        id="sendBtn"
      >
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

// Define props (only once!)
const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

// Define events
const emit = defineEmits(['send'])

// Local state
const message = ref('')
const inputRef = ref(null)

// Computed properties
const canSend = computed(() => {
  return message.value.trim().length > 0
})

// Methods
const handleSend = () => {
  if (canSend.value && !props.disabled) {
    const messageToSend = message.value.trim()
    emit('send', messageToSend)
    message.value = ''
    
    // Focus back to input after sending
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus()
      }
    })
  }
}

const handleKeyPress = (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !props.disabled) {
    event.preventDefault()
    handleSend()
  }
}
</script>

<style scoped>
/* Component-specific styles can go here if needed */
/* Most styles will come from the global dashboard.css */
</style>