import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { IMessage } from '../interfaces/message.interface'

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
  onMessage?: (message: IMessage) => void
  onTyping?: (data: { userId: string; isTyping: boolean }) => void
  onMessageDelivered?: (messageId: string) => void
  onMessageRead?: (messageId: string) => void
  onUserOnline?: (userId: string) => void
  onUserOffline?: (userId: string) => void
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

    try {
      socket.value = io(config.url, {
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10000,
        transports: ['websocket', 'polling'],
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

    // Custom events
    socket.value.on('message', (message: IMessage) => {
      events?.onMessage?.(message)
    })

    socket.value.on('typing', (data: { userId: string; isTyping: boolean }) => {
      events?.onTyping?.(data)
    })

    socket.value.on('message:delivered', (messageId: string) => {
      events?.onMessageDelivered?.(messageId)
    })

    socket.value.on('message:read', (messageId: string) => {
      events?.onMessageRead?.(messageId)
    })

    socket.value.on('user:online', (userId: string) => {
      events?.onUserOnline?.(userId)
    })

    socket.value.on('user:offline', (userId: string) => {
      events?.onUserOffline?.(userId)
    })
  }

  // Send message
  const sendMessage = (message: Partial<IMessage>) => {
    if (!socket.value?.connected) {
      console.error('Socket not connected')
      return false
    }

    socket.value.emit('message:send', message)
    return true
  }

  // Send typing indicator
  const sendTyping = (isTyping: boolean) => {
    if (!socket.value?.connected) return

    socket.value.emit('typing', { isTyping })
  }

  // Mark message as delivered
  const markAsDelivered = (messageId: string) => {
    if (!socket.value?.connected) return

    socket.value.emit('message:delivered', { messageId })
  }

  // Mark message as read
  const markAsRead = (messageId: string) => {
    if (!socket.value?.connected) return

    socket.value.emit('message:read', { messageId })
  }

  // Join room/channel
  const joinRoom = (roomId: string) => {
    if (!socket.value?.connected) return false

    socket.value.emit('room:join', { roomId })
    return true
  }

  // Leave room/channel
  const leaveRoom = (roomId: string) => {
    if (!socket.value?.connected) return

    socket.value.emit('room:leave', { roomId })
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
    markAsDelivered,
    markAsRead,
    joinRoom,
    leaveRoom,
    emit,
    on,
    off,
  }
}
