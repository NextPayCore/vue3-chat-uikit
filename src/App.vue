<template>
  <div class="chat-app">
    <div class="chat-container">
      <!-- Header -->
      <div class="chat-header">
        <h1>ChatGPT Clone Demo</h1>
        <p>Vue 3 Chat UI Kit</p>
      </div>

      <!-- Chat messages area -->
      <ChatList
        :messages="messages"
        :auto-scroll="true"
        :show-token-quota="true"
        :token-quota="tokenQuota"
        @message-click="handleMessageClick"
        @reply="handleReply"
      />

      <!-- Input area -->
      <ChatInput
        :disabled="isLoading"
        placeholder="Message ChatGPT..."
        :reply-to="replyingTo"
        @send="handleSendMessage"
        @typing="handleTyping"
        @voice-start="handleVoiceStart"
        @voice-end="handleVoiceEnd"
        @cancel-reply="handleCancelReply"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import ChatList from './components/ChatList.vue'
import ChatInput from './components/ChatInput.vue'
import type { IMessage } from './interfaces/message.interface'
import type { IUploadedFile } from './interfaces/chatinput.interface'

interface VoiceRecording {
  id: string
  blob: Blob
  duration: number
  url: string
}

const messages = ref<IMessage[]>([
  {
    id: '1',
    content: 'Hello! How can I help you today?',
    role: 'assistant',
    timestamp: new Date(Date.now() - 60000),
    type: 'text'
  }
])

const isLoading = ref(false)
const replyingTo = ref<(IMessage & { selectedText?: string }) | null>(null)

// Token quota state
const tokenQuota = ref({
  used: 1250,
  total: 2000,
  label: 'API Tokens'
})

const handleSendMessage = async (data: { message: string; files: IUploadedFile[]; voice?: VoiceRecording }) => {
  // Add user message
  let userContent = data.message
  if (data.voice) {
    userContent = userContent || `Voice message (${data.voice.duration}s)`
  } else if (data.files.length > 0) {
    userContent = userContent || `Uploaded ${data.files.length} file(s)`
  }

  const userMessage: IMessage = {
    id: Date.now().toString(),
    content: userContent,
    role: 'user',
    timestamp: new Date(),
    type: data.voice ? 'audio' : (data.files.some(f => f.type.startsWith('image/')) ? 'image' : 'text'),
    metadata: {
      files: data.files.length > 0 ? data.files : undefined,
      voice: data.voice
    },
    replyTo: replyingTo.value ? {
      id: replyingTo.value.id,
      content: replyingTo.value.content,
      role: replyingTo.value.role,
      timestamp: replyingTo.value.timestamp,
      selectedText: replyingTo.value.selectedText
    } : undefined
  }

  messages.value.push(userMessage)

  // Simulate token usage increase
  const messageTokens = Math.floor(Math.random() * 50) + 10 // Random 10-60 tokens
  tokenQuota.value.used = Math.min(tokenQuota.value.used + messageTokens, tokenQuota.value.total)

  // Clear reply state
  replyingTo.value = null

  // Simulate assistant typing
  isLoading.value = true

  // Add typing indicator
  const typingMessage: IMessage = {
    id: 'typing',
    content: '',
    role: 'assistant',
    timestamp: new Date(),
    type: 'text',
    isTyping: true
  }

  await nextTick()
  messages.value.push(typingMessage)

  // Simulate response delay
  setTimeout(() => {
    // Remove typing message
    messages.value = messages.value.filter(m => m.id !== 'typing')

    // Create response based on content
    let responseContent = ''
    if (data.voice) {
      responseContent = `I received your voice message of ${data.voice.duration} seconds. `
      if (data.message) {
        responseContent += `Along with text: "${data.message}". `
      }
      responseContent += 'This is a demo response. In a real application, I would transcribe and process the audio.'
    } else if (data.files.length > 0) {
      const fileNames = data.files.map(f => f.name).join(', ')
      responseContent = `I can see you've uploaded: ${fileNames}. `
      if (data.message) {
        responseContent += `And your message: "${data.message}". `
      }
      responseContent += 'This is a demo response. In a real application, I would process these files and provide relevant information.'
    } else if (data.message) {
      responseContent = `I received your message: "${data.message}". This is a demo response from the ChatGPT-like UI. The actual AI integration would go here.`
    }

    // Add assistant response
    const assistantMessage: IMessage = {
      id: (Date.now() + 1).toString(),
      content: responseContent,
      role: 'assistant',
      timestamp: new Date(),
      type: 'text'
    }

    messages.value.push(assistantMessage)

    // Simulate token usage for assistant response
    const responseTokens = Math.floor(Math.random() * 80) + 20 // Random 20-100 tokens
    tokenQuota.value.used = Math.min(tokenQuota.value.used + responseTokens, tokenQuota.value.total)

    isLoading.value = false
  }, 2000)
}

const handleMessageClick = (message: IMessage) => {
  console.log('Message clicked:', message)
}

const handleTyping = (isTyping: boolean) => {
  console.log('User typing:', isTyping)
}

const handleVoiceStart = () => {
  console.log('Voice recording started')
}

const handleVoiceEnd = (recording: VoiceRecording) => {
  console.log('Voice recording ended:', recording)
}

const handleReply = (message: IMessage, selectedText?: string) => {
  replyingTo.value = {
    ...message,
    selectedText
  }
  console.log('Replying to message:', message, 'Selected text:', selectedText)
}

const handleCancelReply = () => {
  replyingTo.value = null
  console.log('Reply cancelled')
}
</script>

<style scoped>
.chat-app {
  height: 100vh;
  background: #f7f7f8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.chat-container {
  width: 100%;
  max-width: 800px;
  height: 90vh;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  background: linear-gradient(135deg, #10a37f 0%, #1a7f64 100%);
  color: white;
  padding: 20px;
  text-align: center;
}

.chat-header h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.chat-header p {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
}

@media (max-width: 768px) {
  .chat-app {
    padding: 0;
  }

  .chat-container {
    height: 100vh;
    border-radius: 0;
    max-width: none;
  }

  .chat-header {
    padding: 16px;
  }

  .chat-header h1 {
    font-size: 20px;
  }
}
</style>
