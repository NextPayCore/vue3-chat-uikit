<template>
  <div class="chat-app">
    <!-- Login Modal -->
    <LoginModal v-model="showLoginModal" @success="handleLoginSuccess" />

    <div class="chat-container">
      <!-- Header -->
      <div class="chat-header">
        <div class="header-content">
          <div>
            <h1>ChatGPT Clone Demo</h1>
            <p>Vue 3 Chat UI Kit with Socket.IO</p>
          </div>
          <div class="header-actions">
            <!-- User Info -->
            <div v-if="isAuthenticated" class="user-info">
              <el-avatar :src="authUser?.avatarUrl" :size="32">
                {{ authUser?.name?.charAt(0) }}
              </el-avatar>
              <span class="user-name">{{ authUser?.name }}</span>
              <el-button
                type="danger"
                size="small"
                text
                @click="handleSignOut"
                :loading="authLoading"
              >
                Sign Out
              </el-button>
            </div>

            <!-- Connection Status -->
            <div class="connection-status">
              <el-tooltip :content="connectionStatusText" placement="bottom">
                <div class="status-indicator" :class="connectionStatusClass">
                  <el-icon v-if="isConnected" :size="16"><CircleCheckFilled /></el-icon>
                  <el-icon v-else-if="isConnecting" :size="16" class="rotating"><Loading /></el-icon>
                  <el-icon v-else :size="16"><CircleCloseFilled /></el-icon>
                  <span>{{ connectionStatusText }}</span>
                </div>
              </el-tooltip>
            </div>
          </div>
        </div>
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
        :disabled="!isAuthenticated || isLoading || (USE_SOCKET && !isConnected)"
        :placeholder="isAuthenticated ? 'Message ChatGPT...' : 'Please sign in to chat'"
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
import { ref, nextTick, computed, onMounted, watch } from 'vue'
import { CircleCheckFilled, CircleCloseFilled, Loading } from '@element-plus/icons-vue'
import { ElAvatar, ElButton, ElTooltip, ElIcon } from 'element-plus'
import ChatList from './components/ChatList.vue'
import ChatInput from './components/ChatInput.vue'
import LoginModal from './components/LoginModal.vue'
import { useSocket } from './composables/useSocket'
import { useAuth } from './composables/useAuth'
import type { IMessage } from './interfaces/message.interface'
import type { IUploadedFile } from './interfaces/chatinput.interface'
import { MessageStatusEnum } from './enums/message.enum'

interface VoiceRecording {
  id: string
  blob: Blob
  duration: number
  url: string
}

// Socket configuration
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'
const USE_SOCKET = import.meta.env.VITE_USE_SOCKET === 'true'

// Auth
const {
  currentUser: authUser,
  isAuthenticated,
  isLoading: authLoading,
  signOut
} = useAuth()

const showLoginModal = ref(!isAuthenticated.value)

// Watch auth state to show/hide login modal
watch(isAuthenticated, (newValue) => {
  if (!newValue) {
    showLoginModal.value = true
  }
})

// Default users
const assistantUser = {
  id: 'assistant-1',
  name: 'AI Assistant',
  avatarUrl: '',
  isOnline: true
}

const messages = ref<IMessage[]>([
  {
    id: '1',
    content: `Hello! 👋 I'm your **AI assistant**. I support full *markdown* formatting!

Here are some examples:

## Features
- **Bold text** and *italic text*
- \`inline code\` and code blocks
- [Links](https://example.com)
- Lists and quotes

### Code Example
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

> You can use the markdown toolbar below to format your messages easily!

How can I help you today?`,
    role: 'assistant',
    timestamp: new Date(Date.now() - 60000),
    type: 'text',
    sender: assistantUser,
    status: MessageStatusEnum.DELIVERED,
    createdAt: new Date(Date.now() - 60000),
    updatedAt: new Date(Date.now() - 60000)
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

// Initialize socket
const {
  isConnected,
  isConnecting,
  error: socketError,
  connect,
  disconnect,
  sendMessage: socketSendMessage,
  sendTyping,
  markAsDelivered,
  markAsRead
} = useSocket(
  {
    url: SOCKET_URL,
    options: {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    }
  },
  {
    onConnect: () => {
      console.log('✅ Socket connected successfully')
    },
    onDisconnect: () => {
      console.log('❌ Socket disconnected')
    },
    onError: (error) => {
      console.error('Socket error:', error)
    },
    onMessage: (message: IMessage) => {
      console.log('📩 New message received:', message)

      // Remove typing indicator if exists
      messages.value = messages.value.filter(m => m.id !== 'typing')

      // Add new message
      messages.value.push(message)

      // Mark as delivered
      markAsDelivered(message.id)

      // Simulate token usage
      const responseTokens = Math.floor(Math.random() * 80) + 20
      tokenQuota.value.used = Math.min(tokenQuota.value.used + responseTokens, tokenQuota.value.total)
    },
    onTyping: (data) => {
      console.log('User typing:', data)

      if (data.isTyping && data.userId !== authUser.value?.id) {
        // Add typing indicator if not already present
        const hasTyping = messages.value.some(m => m.id === 'typing')
        if (!hasTyping) {
          const typingNow = new Date()
          messages.value.push({
            id: 'typing',
            content: '',
            role: 'assistant',
            timestamp: typingNow,
            type: 'text',
            isTyping: true,
            sender: assistantUser,
            status: MessageStatusEnum.SENT,
            createdAt: typingNow,
            updatedAt: typingNow
          })
        }
      } else {
        // Remove typing indicator
        messages.value = messages.value.filter(m => m.id !== 'typing')
      }
    },
    onMessageDelivered: (messageId) => {
      console.log('Message delivered:', messageId)
      const message = messages.value.find(m => m.id === messageId)
      if (message) {
        message.status = MessageStatusEnum.DELIVERED
      }
    },
    onMessageRead: (messageId) => {
      console.log('Message read:', messageId)
      const message = messages.value.find(m => m.id === messageId)
      if (message) {
        message.status = MessageStatusEnum.READ
      }
    }
  }
)

// Connection status computed properties
const connectionStatusText = computed(() => {
  if (isConnected.value) return 'Connected'
  if (isConnecting.value) return 'Connecting...'
  return 'Disconnected'
})

const connectionStatusClass = computed(() => {
  if (isConnected.value) return 'status-connected'
  if (isConnecting.value) return 'status-connecting'
  return 'status-disconnected'
})

// Auth handlers
const handleLoginSuccess = () => {
  console.log('✅ Login successful')
  showLoginModal.value = false

  // Connect socket if enabled
  if (USE_SOCKET) {
    console.log('🔌 Connecting to socket server:', SOCKET_URL)
    connect()
  }
}

const handleSignOut = () => {
  signOut()

  // Disconnect socket
  if (USE_SOCKET) {
    disconnect()
  }

  // Clear messages
  messages.value = [{
    id: '1',
    content: `Hello! 👋 I'm your **AI assistant**. Sign in to start chatting!`,
    role: 'assistant',
    timestamp: new Date(),
    type: 'text',
    sender: assistantUser,
    status: MessageStatusEnum.DELIVERED,
    createdAt: new Date(),
    updatedAt: new Date()
  }]

  // Reset token quota
  tokenQuota.value = {
    used: 0,
    total: 2000,
    label: 'API Tokens'
  }
}

// Connect to socket on mount (only if enabled and authenticated)
onMounted(() => {
  if (!isAuthenticated.value) {
    console.log('⚠️ User not authenticated, showing login modal')
    showLoginModal.value = true
  } else if (USE_SOCKET) {
    console.log('🔌 Connecting to socket server:', SOCKET_URL)
    connect()
  } else {
    console.log('⚠️ Socket disabled, using demo mode')
  }
})

const handleSendMessage = async (data: { message: string; files: IUploadedFile[]; voice?: VoiceRecording }) => {
  if (!isAuthenticated.value) {
    showLoginModal.value = true
    return
  }

  // Add user message
  let userContent = data.message
  if (data.voice) {
    userContent = userContent || `Voice message (${data.voice.duration}s)`
  } else if (data.files.length > 0) {
    userContent = userContent || `Uploaded ${data.files.length} file(s)`
  }

  const now = new Date()

  const userMessage: IMessage = {
    id: Date.now().toString(),
    content: userContent,
    role: 'user',
    timestamp: now,
    type: data.voice ? 'audio' : (data.files.some(f => f.type.startsWith('image/')) ? 'image' : 'text'),
    metadata: {
      files: data.files.length > 0 ? data.files : undefined,
      voice: data.voice
    },
    sender: {
      id: authUser.value?.id || 'user-1',
      name: authUser.value?.name || 'You',
      avatarUrl: authUser.value?.avatarUrl || '',
      isOnline: true
    },
    status: MessageStatusEnum.SENT,
    createdAt: now,
    updatedAt: now,
    replyTo: replyingTo.value || undefined
  }

  messages.value.push(userMessage)

  // Simulate token usage increase
  const messageTokens = Math.floor(Math.random() * 50) + 10 // Random 10-60 tokens
  tokenQuota.value.used = Math.min(tokenQuota.value.used + messageTokens, tokenQuota.value.total)

  // Clear reply state
  replyingTo.value = null

  // Send via socket if connected
  if (USE_SOCKET && isConnected.value) {
    const sent = socketSendMessage(userMessage)
    if (sent) {
      console.log('✉️ Message sent via socket')
      return
    }
  }

  // Fallback to demo mode
  isLoading.value = true

  // Add typing indicator
  const typingNow = new Date()
  const typingMessage: IMessage = {
    id: 'typing',
    content: '',
    role: 'assistant',
    timestamp: typingNow,
    type: 'text',
    isTyping: true,
    sender: assistantUser,
    status: MessageStatusEnum.SENT,
    createdAt: typingNow,
    updatedAt: typingNow
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
    const assistantNow = new Date()
    const assistantMessage: IMessage = {
      id: (Date.now() + 1).toString(),
      content: responseContent,
      role: 'assistant',
      timestamp: assistantNow,
      type: 'text',
      sender: assistantUser,
      status: MessageStatusEnum.DELIVERED,
      createdAt: assistantNow,
      updatedAt: assistantNow
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

  // Mark as read when clicked
  if (USE_SOCKET && isConnected.value && message.role === 'assistant') {
    markAsRead(message.id)
  }
}

const handleTyping = (isTyping: boolean) => {
  console.log('User typing:', isTyping)

  // Send typing indicator via socket
  if (USE_SOCKET && isConnected.value) {
    sendTyping(isTyping)
  }
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
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: white;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-status {
  display: flex;
  align-items: center;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.status-indicator.status-connected {
  background: rgba(52, 211, 153, 0.2);
  color: #10b981;
  border: 1px solid rgba(52, 211, 153, 0.3);
}

.status-indicator.status-connecting {
  background: rgba(251, 191, 36, 0.2);
  color: #f59e0b;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.status-indicator.status-disconnected {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.status-indicator .el-icon {
  flex-shrink: 0;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.rotating {
  animation: rotate 1s linear infinite;
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

  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .header-actions {
    width: 100%;
    flex-direction: column;
    gap: 8px;
  }

  .user-info {
    width: 100%;
    justify-content: space-between;
    padding: 6px 12px;
  }

  .user-name {
    max-width: 120px;
    font-size: 13px;
  }

  .chat-header h1 {
    font-size: 20px;
  }

  .status-indicator {
    padding: 6px 12px;
    font-size: 12px;
  }
}
</style>
