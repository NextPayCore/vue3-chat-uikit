import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { IMessage } from '../interfaces/message.interface'
import type { IConversation } from '../interfaces/conversation.interface'
import { normalizeSocketMessage, normalizeSocketConversation } from '../utils/socketMessageParser'

interface SocketConfig {
  url: string
  options?: {
    autoConnect?: boolean
    reconnection?: boolean
    reconnectionDelay?: number
    reconnectionAttempts?: number
    timeout?: number
    transports?: string[]
    auth?: Record<string, any>
  }
}

interface SocketEvents {
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
  onNewMessage?: (message: IMessage) => void
  onUserTyping?: (data: { userId: string; conversationId: string; isTyping: boolean }) => void
  onMessageRead?: (data: { messageId: string; readBy: string[] }) => void
  onConversationUpdated?: (data: { conversationId: string; lastMessage?: IMessage }) => void
  onUserOnline?: (userId: string) => void
  onUserOffline?: (userId: string) => void
  currentUserId?: string // Add current user ID for message normalization
}

export function useSocket(config: SocketConfig, events?: SocketEvents) {
  const socket = ref<Socket | null>(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const error = ref<Error | null>(null)

  // Connect to socket server
  const connect = () => {
    if (socket.value?.connected) {
      console.warn('Socket already connected')
      return
    }

    isConnecting.value = true
    error.value = null
    console.log('Connecting to socket server...', config.options)
    try {
      socket.value = io(config.url, {
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10000,
        transports: ['websocket'],
        ...config.options,
      })

      // Setup event listeners
      setupSocketListeners()

      // Connect
      socket.value.connect()
    } catch (err) {
      error.value = err as Error
      isConnecting.value = false
      console.error('Socket connection error:', err)
    }
  }

  // Disconnect from socket server
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
    }
  }

  // Setup socket event listeners
  const setupSocketListeners = () => {
    if (!socket.value) return

    socket.value.on('connect', () => {
      isConnected.value = true
      isConnecting.value = false
      error.value = null
      console.log('Socket connected:', socket.value?.id)
      events?.onConnect?.()
    })

    socket.value.on('disconnect', (reason) => {
      isConnected.value = false
      console.log('Socket disconnected:', reason)
      events?.onDisconnect?.()
    })

    socket.value.on('connect_error', (err) => {
      isConnecting.value = false
      error.value = err
      console.error('Socket connection error:', err)
      events?.onError?.(err)
    })

    socket.value.on('error', (err) => {
      error.value = err
      console.error('Socket error:', err)
      events?.onError?.(err)
    })

    // Chat API events (following the documentation)
    socket.value.on('new_message', (rawMessage: any) => {
      console.log('📩 Received new_message event (raw):', rawMessage)

      // Normalize message using utility
      const normalizedMessage = normalizeSocketMessage(rawMessage, events?.currentUserId)
      console.log('📩 Normalized message:', normalizedMessage)

      events?.onNewMessage?.(normalizedMessage)
    })

    socket.value.on('user_typing', (data: { userId: string; conversationId: string; isTyping: boolean }) => {
      console.log('⌨️ Received user_typing event:', data)
      events?.onUserTyping?.(data)
    })

    socket.value.on('message_read', (data: { messageId: string; readBy: string[] }) => {
      console.log('✅ Received message_read event:', data)
      events?.onMessageRead?.(data)
    })

    socket.value.on('conversation_updated', (rawData: any) => {
      console.log('🔄 Received conversation_updated event (raw):', rawData)

      // Normalize conversation and message if present
      const normalizedData = {
        conversationId: rawData.conversationId,
        lastMessage: rawData.lastMessage
          ? normalizeSocketMessage(rawData.lastMessage, events?.currentUserId)
          : undefined
      }
      console.log('🔄 Normalized conversation_updated:', normalizedData)

      events?.onConversationUpdated?.(normalizedData)
    })

    socket.value.on('user:online', (userId: string) => {
      events?.onUserOnline?.(userId)
    })

    socket.value.on('user:offline', (userId: string) => {
      events?.onUserOffline?.(userId)
    })
  }

  // Send message via socket (following Chat API docs)
  const sendMessage = (conversationId: string, message: { content: string; type?: string; replyTo?: string }) => {
    if (!socket.value?.connected) {
      console.error('Socket not connected')
      return false
    }

    console.log('📤 Emitting send_message:', { conversationId, message })
    socket.value.emit('send_message', {
      conversationId,
      message
    })
    return true
  }

  // Send typing indicator (following Chat API docs)
  const sendTyping = (conversationId: string, isTyping: boolean) => {
    if (!socket.value?.connected) return

    const event = isTyping ? 'typing_start' : 'typing_stop'
    console.log(`⌨️ Emitting ${event}:`, { conversationId })
    socket.value.emit(event, { conversationId })
  }

  // Mark message as read (following Chat API docs)
  const markAsRead = (conversationId: string, messageId: string) => {
    if (!socket.value?.connected) return

    console.log('✅ Emitting mark_as_read:', { conversationId, messageId })
    socket.value.emit('mark_as_read', {
      conversationId,
      messageId
    })
  }

  // Mark message as delivered (deprecated in favor of mark_as_read)
  const markAsDelivered = (messageId: string) => {
    console.warn('markAsDelivered is deprecated, use markAsRead instead')
  }

  // Join conversation (following Chat API docs)
  const joinConversation = (conversationId: string) => {
    if (!socket.value?.connected) return false

    console.log('🚪 Emitting join_conversation:', { conversationId })
    socket.value.emit('join_conversation', { conversationId })
    return true
  }

  // Leave conversation (following Chat API docs)
  const leaveConversation = (conversationId: string) => {
    if (!socket.value?.connected) return

    console.log('👋 Emitting leave_conversation:', { conversationId })
    socket.value.emit('leave_conversation', { conversationId })
  }

  // Emit custom event
  const emit = (event: string, data?: any) => {
    if (!socket.value?.connected) {
      console.error('Socket not connected')
      return false
    }

    socket.value.emit(event, data)
    return true
  }

  // Listen to custom event
  const on = (event: string, callback: (...args: any[]) => void) => {
    if (!socket.value) return

    socket.value.on(event, callback)
  }

  // Remove custom event listener
  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (!socket.value) return

    if (callback) {
      socket.value.off(event, callback)
    } else {
      socket.value.off(event)
    }
  }

  // Auto cleanup on unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendMessage,
    sendTyping,
    markAsRead,
    markAsDelivered,
    joinConversation,
    leaveConversation,
    emit,
    on,
    off,
  }
}
