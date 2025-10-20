<template>
  <div class="chat-app">
    <!-- Login Modal -->
    <LoginModal v-model="showLoginModal" @success="handleLoginSuccess" />

    <!-- Search Friends Drawer -->
    <el-drawer
      v-model="showSearchDrawer"
      title="Search Friends"
      direction="rtl"
      size="600px"
      :before-close="handleCloseSearch"
    >
      <SearchFriends
        @send-request="handleFriendRequestSent"
        @accept-request="handleFriendRequestAccepted"
        @reject-request="handleFriendRequestRejected"
      />
    </el-drawer>

    <!-- Friendship Manager Drawer -->
    <el-drawer
      v-model="showFriendshipDrawer"
      title="Friends & Requests"
      direction="rtl"
      size="600px"
    >
      <FriendshipManager
        @start-chat="handleStartChat"
        @refresh="handleFriendshipRefresh"
      />
    </el-drawer>

    <div class="chat-container">
      <!-- Header -->
      <div class="chat-header">
        <div class="header-content">
          <div>
            <h1>Chat Application</h1>
            <p>Vue 3 Chat UI Kit with Socket.IO & Real-time Messaging</p>
          </div>
          <div class="header-actions">
            <!-- User Info -->
            <div v-if="isAuthenticated" class="user-info">
              <el-avatar :src="authUser?.avatarUrl" :size="32">
                {{ authUser?.name?.charAt(0) }}
              </el-avatar>
              <span class="user-name">{{ authUser?.name }}</span>

              <!-- Search Friends Button -->
              <el-badge
                :value="totalPendingRequests"
                :hidden="!totalPendingRequests"
                :max="99"
                type="danger"
              >
                <el-button
                  type="primary"
                  size="small"
                  @click="showFriendshipDrawer = true"
                >
                  <el-icon><UserFilled /></el-icon>
                  Friends & Requests
                </el-button>
              </el-badge>

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
            <div v-if="USE_SOCKET" class="connection-status">
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

      <!-- Main chat area -->
      <div class="chat-main">
        <!-- Conversation list sidebar -->
        <div class="conversation-sidebar">
          <ConversationList @select="handleSelectConversation" />
        </div>

        <!-- Chat area -->
        <div class="chat-area">
          <template v-if="activeConversation">
            <!-- Conversation header -->
            <div class="conversation-header">
              <div class="conversation-info">
                <el-avatar :src="conversationAvatar" :size="40">
                  {{ conversationName.charAt(0) }}
                </el-avatar>
                <div class="conversation-details">
                  <h3>{{ conversationName }}</h3>
                  <p v-if="typingUsers.length > 0" class="typing-indicator">
                    {{ typingUsers.join(', ') }} {{ typingUsers.length === 1 ? 'is' : 'are' }} typing...
                  </p>
                  <p v-else-if="activeConversation.type === 'group'">
                    {{ activeConversation.participants.length }} members
                  </p>
                  <p v-else class="online-status">
                    {{ isOtherUserOnline ? '🟢 Online' : '⚪ Offline' }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Chat messages area -->
            <ChatList
              :messages="currentMessages"
              :auto-scroll="true"
              @message-click="handleMessageClick"
              @reply="handleReply"
            />

            <!-- Input area -->
            <ChatInput
              :disabled="!isAuthenticated || isLoading || (USE_SOCKET && !isConnected)"
              :placeholder="isAuthenticated ? `Message ${conversationName}...` : 'Please sign in to chat'"
              :reply-to="replyingTo"
              @send="handleSendMessage"
              @typing="handleTyping"
              @voice-start="handleVoiceStart"
              @voice-end="handleVoiceEnd"
              @cancel-reply="handleCancelReply"
            />
          </template>

          <!-- Empty state -->
          <div v-else class="empty-conversation-state">
            <el-empty description="Select a conversation to start chatting">
              <template #image>
                <el-icon :size="100" color="#909399">
                  <ChatDotRound />
                </el-icon>
              </template>
            </el-empty>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onMounted, watch } from 'vue'
import { CircleCheckFilled, CircleCloseFilled, Loading, UserFilled, ChatDotRound } from '@element-plus/icons-vue'
import { ElAvatar, ElButton, ElTooltip, ElIcon, ElDrawer, ElMessage, ElEmpty, ElBadge } from 'element-plus'
import ChatList from './components/ChatList.vue'
import ChatInput from './components/ChatInput.vue'
import LoginModal from './components/LoginModal.vue'
import SearchFriends from './components/SearchFriends.vue'
import FriendshipManager from './components/FriendshipManager.vue'
import ConversationList from './components/ConversationList.vue'
import { useSocket } from './composables/useSocket'
import { useAuth } from './composables/useAuth'
import { useFriendship } from './composables/useFriendship'
import { useConversation } from './composables/useConversation'
import { useMessages } from './composables/useMessages'
import type { IMessage } from './interfaces/message.interface'
import type { IUploadedFile } from './interfaces/chatinput.interface'
import type { IFriendUser } from './interfaces/friendship.interface'
import type { IConversation } from './interfaces/conversation.interface'
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

// Friendship
const {
  totalPendingRequests,
  getFriendshipList
} = useFriendship()

// Conversation
const {
  activeConversation,
  setActiveConversation,
  getConversations,
  createConversation
} = useConversation()

// Messages
const {
  getMessages,
  getChatHistory,
  sendMessage: sendRestMessage,
  markAllAsRead,
  addMessage,
  clearMessages
} = useMessages()

const showLoginModal = ref(!isAuthenticated.value)
const showSearchDrawer = ref(false)
const showFriendshipDrawer = ref(false)

// Watch auth state to show/hide login modal
watch(isAuthenticated, (newValue) => {
  if (!newValue) {
    showLoginModal.value = true
    showSearchDrawer.value = false
    showFriendshipDrawer.value = false
  }
})

const isLoading = ref(false)
const replyingTo = ref<(IMessage & { selectedText?: string }) | null>(null)
const typingUsers = ref<string[]>([])
const onlineUsers = ref<Set<string>>(new Set())

// Computed
const currentMessages = computed((): IMessage[] => {
  if (!activeConversation.value) return []

  const chatMessages = getMessages(activeConversation.value._id)

  // Convert IChatMessage to IMessage for the ChatList component
  return chatMessages.map(msg => ({
    id: msg.id,
    content: msg.content,
    contentText: msg.content,
    sender: {
      id: msg.senderId,
      name: msg.senderName || 'Unknown',
      avatarUrl: msg.senderAvatar || '',
      isOnline: true
    },
    status: msg.readBy.includes(authUser.value?.id || '')
      ? MessageStatusEnum.READ
      : MessageStatusEnum.DELIVERED,
    role: msg.senderId === authUser.value?.id ? 'user' : 'assistant',
    timestamp: new Date(msg.createdAt),
    type: msg.type === 'image' ? 'image' : msg.type === 'file' ? 'text' : 'text',
    createdAt: new Date(msg.createdAt),
    updatedAt: new Date(msg.updatedAt),
    metadata: {
      isEdited: msg.isEdited,
      isDeleted: msg.isDeleted,
      fileUrl: msg.fileUrl,
      fileName: msg.fileName
    },
    replyTo: msg.replyToMessage ? {
      id: msg.replyToMessage.id,
      content: msg.replyToMessage.content,
      contentText: msg.replyToMessage.content,
      sender: {
        id: msg.replyToMessage.senderId,
        name: msg.replyToMessage.senderName || 'Unknown',
        avatarUrl: msg.replyToMessage.senderAvatar || '',
        isOnline: true
      },
      status: MessageStatusEnum.DELIVERED,
      role: msg.replyToMessage.senderId === authUser.value?.id ? 'user' : 'assistant',
      timestamp: new Date(msg.replyToMessage.createdAt),
      createdAt: new Date(msg.replyToMessage.createdAt),
      updatedAt: new Date(msg.replyToMessage.updatedAt)
    } as IMessage : undefined
  } as IMessage))
})

const conversationName = computed(() => {
  if (!activeConversation.value) return ''

  if (activeConversation.value.type === 'group') {
    return activeConversation.value.name || 'Unnamed Group'
  }

  // For private chat, show the other participant's name
  const otherParticipant = activeConversation.value.participants.find(
    p => p.id !== authUser.value?.id
  )
  return otherParticipant?.name || 'Unknown User'
})

const conversationAvatar = computed(() => {
  if (!activeConversation.value) return ''

  if (activeConversation.value.type === 'group') {
    return activeConversation.value.avatar || ''
  }

  // For private chat, show the other participant's avatar
  const otherParticipant = activeConversation.value.participants.find(
    p => p.id !== authUser.value?.id
  )
  return otherParticipant?.avatarUrl || ''
})

const isOtherUserOnline = computed(() => {
  if (!activeConversation.value || activeConversation.value.type === 'group') {
    return false
  }

  const otherParticipant = activeConversation.value.participants.find(
    p => p.id !== authUser.value?.id
  )

  return otherParticipant ? onlineUsers.value.has(otherParticipant.id) : false
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
  markAsRead,
  joinConversation,
  leaveConversation
} = useSocket(
  {
    url: SOCKET_URL,
    options: {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      auth: {
        token: localStorage.getItem('accessToken') || ''
      }
    }
  },
  {
    onConnect: () => {
      console.log('✅ Socket connected successfully')
      // Rejoin active conversation if exists
      if (activeConversation.value) {
        joinConversation(activeConversation.value._id)
      }
    },
    onDisconnect: () => {
      console.log('❌ Socket disconnected')
      // Clear typing indicators
      typingUsers.value = []
    },
    onError: (error) => {
      console.error('Socket error:', error)
    },
    onNewMessage: (message: IMessage) => {
      console.log('📩 New message received:', message)

      // Convert IMessage to IChatMessage format if needed
      // In production, the backend should send IChatMessage directly
      // For now, we'll just log it and refresh the conversation
      if (activeConversation.value) {
        // Refresh messages for the active conversation
        getChatHistory(activeConversation.value._id, 1, 50)

        // Remove typing indicator for this user
        if (message.sender?.name) {
          typingUsers.value = typingUsers.value.filter(u => u !== message.sender.name)
        }
      }

      // Refresh conversations list to update last message
      getConversations()
    },
    onUserTyping: (data: { userId: string; conversationId: string; isTyping: boolean }) => {
      console.log('⌨️ User typing:', data)

      // Only show typing if it's for the active conversation
      if (activeConversation.value?._id === data.conversationId && data.userId !== authUser.value?.id) {
        // Find the user's name
        const user = activeConversation.value.participants.find(p => p.id === data.userId)
        if (user && user.name) {
          if (data.isTyping) {
            if (!typingUsers.value.includes(user.name)) {
              typingUsers.value.push(user.name)
            }
          } else {
            typingUsers.value = typingUsers.value.filter(u => u !== user.name)
          }
        }
      }
    },
    onMessageRead: (data: { messageId: string; readBy: string[] }) => {
      console.log('✅ Message read:', data)
      // You can update message read status here if needed
    },
    onConversationUpdated: (data: { conversationId: string; lastMessage?: IMessage }) => {
      console.log('🔄 Conversation updated:', data)
      // Refresh conversations list
      getConversations()
    },
    onUserOnline: (userId: string) => {
      console.log('🟢 User online:', userId)
      onlineUsers.value.add(userId)
    },
    onUserOffline: (userId: string) => {
      console.log('⚪ User offline:', userId)
      onlineUsers.value.delete(userId)
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

  // Load data
  Promise.all([
    getFriendshipList(),
    getConversations()
  ])

  // Connect socket if enabled
  if (USE_SOCKET) {
    console.log('🔌 Connecting to socket server:', SOCKET_URL)
    connect()
  }
}

const handleSignOut = () => {
  // Leave conversation before disconnect
  if (activeConversation.value) {
    if (USE_SOCKET && isConnected.value) {
      leaveConversation(activeConversation.value._id)
    }
    setActiveConversation(null)
  }

  signOut()

  // Disconnect socket
  if (USE_SOCKET) {
    disconnect()
  }

  // Clear state
  typingUsers.value = []
  onlineUsers.value.clear()
}

// Conversation handlers
const handleSelectConversation = async (conversation: IConversation) => {
  // Leave previous conversation
  if (activeConversation.value && USE_SOCKET && isConnected.value) {
    leaveConversation(activeConversation.value._id)
  }

  // Set new active conversation
  setActiveConversation(conversation)

  // Load chat history
  isLoading.value = true
  try {
    await getChatHistory(conversation._id, 1, 50)

    // Join conversation via socket
    if (USE_SOCKET && isConnected.value) {
      joinConversation(conversation._id)
    }

    // Mark all as read
    await markAllAsRead(conversation._id)

    // Clear typing indicators
    typingUsers.value = []
  } catch (error) {
    console.error('Failed to load conversation:', error)
  } finally {
    isLoading.value = false
  }
}

const handleSendMessage = async (data: { message: string; files: IUploadedFile[]; voice?: VoiceRecording }) => {
  if (!isAuthenticated.value || !activeConversation.value) {
    if (!isAuthenticated.value) {
      showLoginModal.value = true
    } else {
      ElMessage.warning('Please select a conversation first')
    }
    return
  }

  // Clear reply state
  const replyToId = replyingTo.value?.id
  replyingTo.value = null

  const conversationId = activeConversation.value._id

  // Prepare message content
  let messageContent = data.message || ''
  let messageType: 'text' | 'image' | 'file' | 'system' = 'text'
  let fileUrl: string | undefined
  let fileName: string | undefined

  if (data.voice) {
    messageContent = messageContent || `Voice message (${data.voice.duration}s)`
    // In production, upload the voice file and get the URL
    fileUrl = data.voice.url
    fileName = `voice_${Date.now()}.webm`
    messageType = 'file'
  } else if (data.files.length > 0) {
    const file = data.files[0]
    if (file) {
      messageContent = messageContent || file.name
      fileUrl = file.preview
      fileName = file.name
      messageType = file.type.startsWith('image/') ? 'image' : 'file'
    }
  }

  // Send via socket if connected
  if (USE_SOCKET && isConnected.value) {
    const sent = socketSendMessage(conversationId, {
      content: messageContent,
      type: messageType,
      ...(replyToId && { replyTo: replyToId })
    })

    if (sent) {
      console.log('✉️ Message sent via socket')
      return
    }
  }

  // Fallback to REST API
  isLoading.value = true
  try {
    await sendRestMessage(conversationId, {
      content: messageContent,
      type: messageType,
      ...(fileUrl && { fileUrl }),
      ...(fileName && { fileName }),
      ...(replyToId && { replyTo: replyToId })
    })
  } catch (error) {
    console.error('Failed to send message:', error)
  } finally {
    isLoading.value = false
  }
}

const handleMessageClick = (message: IMessage) => {
  console.log('Message clicked:', message)

  // Mark as read when clicked
  if (USE_SOCKET && isConnected.value && activeConversation.value && message.sender?.id !== authUser.value?.id) {
    markAsRead(activeConversation.value._id, message.id)
  }
}

const handleTyping = (isTyping: boolean) => {
  console.log('User typing:', isTyping)

  // Send typing indicator via socket
  if (USE_SOCKET && isConnected.value && activeConversation.value) {
    sendTyping(activeConversation.value._id, isTyping)
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

// Connect to socket on mount (only if enabled and authenticated)
onMounted(async () => {
  if (!isAuthenticated.value) {
    console.log('⚠️ User not authenticated, showing login modal')
    showLoginModal.value = true
  } else {
    // Load data (only if authenticated)
    try {
      await Promise.all([
        getFriendshipList(),
        getConversations()
      ])
    } catch (error) {
      console.error('Failed to load data:', error)
      // If authentication fails, show login modal
      if (!isAuthenticated.value) {
        showLoginModal.value = true
      }
    }

    if (USE_SOCKET) {
      console.log('🔌 Connecting to socket server:', SOCKET_URL)
      connect()
    } else {
      console.log('⚠️ Socket disabled, using REST API mode')
    }
  }
})

// Search Friends handlers
const handleCloseSearch = (done: () => void) => {
  done()
}

const handleFriendRequestSent = (userId: string) => {
  console.log('Friend request sent to:', userId)
  ElMessage.success('Friend request sent successfully')
}

const handleFriendRequestAccepted = (userId: string) => {
  console.log('Friend request accepted:', userId)
  ElMessage.success('Friend request accepted')
}

const handleFriendRequestRejected = (userId: string) => {
  console.log('Friend request rejected:', userId)
  ElMessage.info('Friend request rejected')
}

// Friendship Manager handlers
const handleStartChat = async (friend: IFriendUser) => {
  console.log('Starting chat with:', friend)

  try {
    // Create or find private conversation with this friend
    const conversation = await createConversation({
      type: 'private',
      participantIds: [friend.id]
    })

    if (conversation) {
      await handleSelectConversation(conversation)
      showFriendshipDrawer.value = false
    }
  } catch (error) {
    console.error('Failed to start chat:', error)
  }
}

const handleFriendshipRefresh = () => {
  console.log('Refreshing friendship data')
  getFriendshipList()
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
  max-width: 1400px;
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
  flex-shrink: 0;
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

.chat-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.conversation-sidebar {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  overflow: hidden;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.conversation-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
  flex-shrink: 0;
}

.conversation-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.conversation-details h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.conversation-details p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.typing-indicator {
  color: #10a37f !important;
  font-style: italic;
}

.online-status {
  display: flex;
  align-items: center;
  gap: 4px;
}

.empty-conversation-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
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

  .conversation-sidebar {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    background: white;
  }

  .conversation-sidebar.show {
    transform: translateX(0);
  }
}
</style>
