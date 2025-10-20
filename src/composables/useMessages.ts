import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useApi } from './useApi'

// Types
export interface IChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName?: string
  senderAvatar?: string
  content: string
  type: 'text' | 'image' | 'file' | 'system'
  fileUrl?: string
  fileName?: string
  readBy: string[]
  replyTo?: string
  replyToMessage?: IChatMessage
  isEdited: boolean
  isDeleted: boolean
  editedAt?: Date
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IMessageHistory {
  conversation: {
    id: string
    type: 'private' | 'group'
    participants: string[]
    name?: string
  }
  messages: IChatMessage[]
  totalMessages: number
  page: number
  limit: number
}

export interface ISendMessagePayload {
  content: string
  type?: 'text' | 'image' | 'file' | 'system'
  fileUrl?: string
  fileName?: string
  replyTo?: string
}

// State
const messages = ref<Map<string, IChatMessage[]>>(new Map())
const isLoadingMessages = ref(false)
const totalMessagesMap = ref<Map<string, number>>(new Map())
const currentPageMap = ref<Map<string, number>>(new Map())

export function useMessages() {
  const api = useApi()

  // Get chat history
  const getChatHistory = async (
    conversationId: string,
    page = 1,
    limit = 50
  ): Promise<IMessageHistory | null> => {
    isLoadingMessages.value = true
    try {
      const data: IMessageHistory = await api.get(
        `/api/chat/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
      )

      // Store messages
      if (!messages.value.has(conversationId)) {
        messages.value.set(conversationId, [])
      }

      // If it's page 1, replace all messages, otherwise append
      if (page === 1) {
        messages.value.set(conversationId, data.messages)
      } else {
        const existing = messages.value.get(conversationId) || []
        messages.value.set(conversationId, [...existing, ...data.messages])
      }

      totalMessagesMap.value.set(conversationId, data.totalMessages)
      currentPageMap.value.set(conversationId, page)

      return data
    } catch (error: any) {
      console.error('Get chat history error:', error)
      ElMessage.error(error.message || 'Failed to load messages')
      return null
    } finally {
      isLoadingMessages.value = false
    }
  }

  // Send message via REST API
  const sendMessage = async (
    conversationId: string,
    payload: ISendMessagePayload
  ): Promise<IChatMessage | null> => {
    try {
      const data = await api.post(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          content: payload.content,
          type: payload.type || 'text',
          ...(payload.fileUrl && { fileUrl: payload.fileUrl }),
          ...(payload.fileName && { fileName: payload.fileName }),
          ...(payload.replyTo && { replyTo: payload.replyTo })
        }
      )

      const newMessage = data.message as IChatMessage

      // Add to local messages
      addMessage(conversationId, newMessage)

      return newMessage
    } catch (error: any) {
      console.error('Send message error:', error)
      ElMessage.error(error.message || 'Failed to send message')
      return null
    }
  }

  // Edit message
  const editMessage = async (
    messageId: string,
    content: string
  ): Promise<boolean> => {
    try {
      const data = await api.put(
        `/chat/messages/${messageId}`,
        { content }
      )

      const updatedMessage = data.message as IChatMessage

      // Update in local messages
      updateMessage(updatedMessage)

      ElMessage.success('Message edited')
      return true
    } catch (error: any) {
      console.error('Edit message error:', error)
      ElMessage.error(error.message || 'Failed to edit message')
      return false
    }
  }

  // Delete message
  const deleteMessage = async (messageId: string): Promise<boolean> => {
    try {
      await api.del(`/chat/messages/${messageId}`)

      // Remove from local messages
      removeMessage(messageId)

      ElMessage.success('Message deleted')
      return true
    } catch (error: any) {
      console.error('Delete message error:', error)
      ElMessage.error(error.message || 'Failed to delete message')
      return false
    }
  }

  // Mark message as read
  const markMessageAsRead = async (messageId: string): Promise<boolean> => {
    try {
      await api.put(`/chat/messages/${messageId}/read`)
      return true
    } catch (error: any) {
      console.error('Mark message as read error:', error)
      return false
    }
  }

  // Mark all messages in conversation as read
  const markAllAsRead = async (conversationId: string): Promise<boolean> => {
    try {
      await api.put(`/api/chat/conversations/${conversationId}/read`)

      // Update local messages readBy
      const conversationMessages = messages.value.get(conversationId)
      if (conversationMessages) {
        const currentUserId = getCurrentUserId()
        conversationMessages.forEach(msg => {
          if (currentUserId && !msg.readBy.includes(currentUserId)) {
            msg.readBy.push(currentUserId)
          }
        })
      }

      return true
    } catch (error: any) {
      console.error('Mark all as read error:', error)
      return false
    }
  }

  // Local state management helpers
  const addMessage = (conversationId: string, message: IChatMessage) => {
    if (!messages.value.has(conversationId)) {
      messages.value.set(conversationId, [])
    }

    const conversationMessages = messages.value.get(conversationId)!

    // Check if message already exists
    const existingIndex = conversationMessages.findIndex(m => m.id === message.id)
    if (existingIndex >= 0) {
      // Update existing message
      conversationMessages[existingIndex] = message
    } else {
      // Add new message
      conversationMessages.push(message)
    }

    // Sort by createdAt
    conversationMessages.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }

  const updateMessage = (message: IChatMessage) => {
    for (const [conversationId, conversationMessages] of messages.value.entries()) {
      const index = conversationMessages.findIndex(m => m.id === message.id)
      if (index >= 0) {
        conversationMessages[index] = message
        break
      }
    }
  }

  const removeMessage = (messageId: string) => {
    for (const [conversationId, conversationMessages] of messages.value.entries()) {
      const index = conversationMessages.findIndex(m => m.id === messageId)
      if (index >= 0) {
        conversationMessages.splice(index, 1)
        break
      }
    }
  }

  const updateMessageReadBy = (messageId: string, readBy: string[]) => {
    for (const [conversationId, conversationMessages] of messages.value.entries()) {
      const message = conversationMessages.find(m => m.id === messageId)
      if (message) {
        message.readBy = readBy
        break
      }
    }
  }

  // Get messages for a conversation
  const getMessages = (conversationId: string): IChatMessage[] => {
    return messages.value.get(conversationId) || []
  }

  // Get unread count for conversation
  const getUnreadCount = (conversationId: string): number => {
    const conversationMessages = messages.value.get(conversationId) || []
    const currentUserId = getCurrentUserId()
    if (!currentUserId) return 0

    return conversationMessages.filter(msg =>
      msg.senderId !== currentUserId && !msg.readBy.includes(currentUserId)
    ).length
  }

  // Clear messages for a conversation
  const clearMessages = (conversationId: string) => {
    messages.value.delete(conversationId)
    totalMessagesMap.value.delete(conversationId)
    currentPageMap.value.delete(conversationId)
  }

  // Helper to get current user ID from token
  const getCurrentUserId = (): string | null => {
    const token = localStorage.getItem('accessToken')
    if (!token) return null

    try {
      const parts = token.split('.')
      if (parts.length !== 3 || !parts[1]) return null
      const payload = JSON.parse(atob(parts[1]))
      return payload.sub || payload.userId || payload.id || null
    } catch (error) {
      return null
    }
  }

  return {
    // State
    messages,
    isLoadingMessages,
    totalMessagesMap,
    currentPageMap,

    // REST API methods
    getChatHistory,
    sendMessage,
    editMessage,
    deleteMessage,
    markMessageAsRead,
    markAllAsRead,

    // Local state management
    addMessage,
    updateMessage,
    removeMessage,
    updateMessageReadBy,
    getMessages,
    getUnreadCount,
    clearMessages,
    getCurrentUserId
  }
}
