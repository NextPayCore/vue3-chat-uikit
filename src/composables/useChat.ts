import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useSocket } from './useSocket'

// Types
interface ITypingUser {
  userId: string
  conversationId: string
  isTyping: boolean
  timestamp: number
}

interface ISendMessageData {
  conversationId: string
  message: {
    content: string
    type: 'text' | 'image' | 'file' | 'system'
    fileUrl?: string
    fileName?: string
    replyTo?: string
  }
}

interface INewMessageData {
  id: string
  conversationId: string
  senderId: string
  content: string
  type: 'text' | 'image' | 'file' | 'system'
  fileUrl?: string
  fileName?: string
  readBy: string[]
  replyTo?: string
  isEdited: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

interface IMessageReadData {
  messageId: string
  readBy: {
    userId: string
    readAt: Date
  }[]
}

interface IConversationUpdatedData {
  conversationId: string
  lastMessage: INewMessageData
  updatedAt: Date
}

// State
const typingUsers = ref<Map<string, ITypingUser>>(new Map())
const socketError = ref<string | null>(null)

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1200'
const socketUrl = import.meta.env.VITE_SOCKET_URL || apiBaseUrl

export function useChat() {
  const { socket, isConnected, connect, disconnect } = useSocket({
    url: socketUrl,
    options: {
      auth: {
        token: localStorage.getItem('accessToken') || ''
      }
    }
  })

  // Typing timeout for cleanup
  const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

  // Join a conversation room
  const joinConversation = (conversationId: string) => {
    if (!socket.value) {
      console.warn('Socket not connected, attempting to connect...')
      connect()
      return
    }

    socket.value.emit('join_conversation', { conversationId })
    console.log('📥 Joined conversation:', conversationId)
  }

  // Leave a conversation room
  const leaveConversation = (conversationId: string) => {
    if (!socket.value) return

    socket.value.emit('leave_conversation', { conversationId })
    console.log('📤 Left conversation:', conversationId)

    // Clear typing indicators for this conversation
    const key = `${conversationId}`
    for (const [userId, user] of typingUsers.value.entries()) {
      if (user.conversationId === conversationId) {
        typingUsers.value.delete(userId)
      }
    }
  }

  // Send message via WebSocket
  const sendMessage = (data: ISendMessageData) => {
    if (!socket.value || !isConnected.value) {
      ElMessage.error('Not connected to chat server')
      return
    }

    socket.value.emit('send_message', data)
    console.log('📤 Sent message:', data)
  }

  // Start typing indicator
  const startTyping = (conversationId: string) => {
    if (!socket.value || !isConnected.value) return

    socket.value.emit('typing_start', { conversationId })
  }

  // Stop typing indicator
  const stopTyping = (conversationId: string) => {
    if (!socket.value || !isConnected.value) return

    socket.value.emit('typing_stop', { conversationId })
  }

  // Mark message as read
  const markAsRead = (conversationId: string, messageId: string) => {
    if (!socket.value || !isConnected.value) return

    socket.value.emit('mark_as_read', {
      conversationId,
      messageId
    })
  }

  // Setup event listeners
  const setupListeners = (callbacks: {
    onNewMessage?: (message: INewMessageData) => void
    onUserTyping?: (data: ITypingUser) => void
    onMessageRead?: (data: IMessageReadData) => void
    onConversationUpdated?: (data: IConversationUpdatedData) => void
    onError?: (error: string) => void
  }) => {
    if (!socket.value) {
      console.warn('Socket not available, connecting...')
      connect()

      // Wait for connection and retry
      setTimeout(() => {
        if (socket.value) {
          setupListeners(callbacks)
        }
      }, 1000)
      return
    }

    // New message event
    if (callbacks.onNewMessage) {
      socket.value.on('new_message', (message: INewMessageData) => {
        console.log('📨 New message received:', message)
        callbacks.onNewMessage?.(message)
      })
    }

    // User typing event
    if (callbacks.onUserTyping) {
      socket.value.on('user_typing', (data: ITypingUser) => {
        console.log('⌨️ User typing:', data)

        const key = `${data.conversationId}-${data.userId}`

        if (data.isTyping) {
          // Add or update typing user
          typingUsers.value.set(key, {
            ...data,
            timestamp: Date.now()
          })

          // Clear existing timeout
          if (typingTimeouts.has(key)) {
            clearTimeout(typingTimeouts.get(key)!)
          }

          // Auto-remove after 3 seconds
          const timeout = setTimeout(() => {
            typingUsers.value.delete(key)
            typingTimeouts.delete(key)
          }, 3000)

          typingTimeouts.set(key, timeout)
        } else {
          // Remove typing user
          typingUsers.value.delete(key)
          if (typingTimeouts.has(key)) {
            clearTimeout(typingTimeouts.get(key)!)
            typingTimeouts.delete(key)
          }
        }

        callbacks.onUserTyping?.(data)
      })
    }

    // Message read event
    if (callbacks.onMessageRead) {
      socket.value.on('message_read', (data: IMessageReadData) => {
        console.log('✓✓ Message read:', data)
        callbacks.onMessageRead?.(data)
      })
    }

    // Conversation updated event
    if (callbacks.onConversationUpdated) {
      socket.value.on('conversation_updated', (data: IConversationUpdatedData) => {
        console.log('🔄 Conversation updated:', data)
        callbacks.onConversationUpdated?.(data)
      })
    }

    // Error event
    if (callbacks.onError) {
      socket.value.on('error', (error: any) => {
        console.error('❌ Socket error:', error)
        const errorMessage = typeof error === 'string' ? error : error.message || 'Socket error'
        socketError.value = errorMessage
        callbacks.onError?.(errorMessage)
      })
    }
  }

  // Remove event listeners
  const removeListeners = () => {
    if (!socket.value) return

    socket.value.off('new_message')
    socket.value.off('user_typing')
    socket.value.off('message_read')
    socket.value.off('conversation_updated')
    socket.value.off('error')

    console.log('🔇 Removed all chat listeners')
  }

  // Cleanup
  const cleanup = () => {
    removeListeners()

    // Clear all typing timeouts
    for (const timeout of typingTimeouts.values()) {
      clearTimeout(timeout)
    }
    typingTimeouts.clear()
    typingUsers.value.clear()

    console.log('🧹 Chat cleanup complete')
  }

  // Get typing users for a conversation
  const getTypingUsers = (conversationId: string) => {
    const users: ITypingUser[] = []
    for (const user of typingUsers.value.values()) {
      if (user.conversationId === conversationId && user.isTyping) {
        users.push(user)
      }
    }
    return users
  }

  // Check if any user is typing in a conversation
  const isAnyoneTyping = computed(() => (conversationId: string) => {
    return getTypingUsers(conversationId).length > 0
  })

  return {
    // State
    typingUsers,
    socketError,
    isConnected,

    // Methods - Connection
    connect,
    disconnect,
    setupListeners,
    removeListeners,
    cleanup,

    // Methods - Conversation
    joinConversation,
    leaveConversation,

    // Methods - Messaging
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,

    // Utilities
    getTypingUsers,
    isAnyoneTyping
  }
}
