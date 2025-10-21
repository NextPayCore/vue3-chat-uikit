import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useApi } from './useApi'
import type {
  IPinnedMessage,
  IConversationPinnedMessages
} from '@/interfaces/pin.interface'

export function usePinMessage() {
  const api = useApi()

  // State
  const pinnedMessages = ref<Map<string, IPinnedMessage[]>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Pin a message
   */
  const pinMessage = async (messageId: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.post(`/api/chat/messages/${messageId}/pin`, {
        messageId
      })

      if (response.success !== false) {
        ElMessage.success('Message pinned successfully')
        return true
      } else {
        throw new Error(response.message || 'Failed to pin message')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to pin message'
      error.value = errorMessage
      ElMessage.error(errorMessage)
      console.error('❌ Pin message error:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Unpin a message
   */
  const unpinMessage = async (messageId: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.del(`/api/chat/messages/${messageId}/pin`)

      if (response.success !== false) {
        ElMessage.success('Message unpinned successfully')
        return true
      } else {
        throw new Error(response.message || 'Failed to unpin message')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to unpin message'
      error.value = errorMessage
      ElMessage.error(errorMessage)
      console.error('❌ Unpin message error:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get all pinned messages in a conversation
   */
  const getPinnedMessages = async (conversationId: string): Promise<IPinnedMessage[]> => {
    isLoading.value = true
    error.value = null

    try {
      const response: IConversationPinnedMessages = await api.get(
        `/api/chat/conversations/${conversationId}/pinned`
      )

      if (response.pinnedMessages) {
        // Store in map
        pinnedMessages.value.set(conversationId, response.pinnedMessages)
        console.log(`✅ Loaded ${response.totalPinned} pinned messages for conversation ${conversationId}`)
        return response.pinnedMessages
      } else {
        return []
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to get pinned messages'
      error.value = errorMessage
      console.error('❌ Get pinned messages error:', err)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Reorder a pinned message
   */
  const reorderPinnedMessage = async (
    messageId: string,
    newOrder: number
  ): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.put(
        `/api/chat/messages/${messageId}/pin/reorder?order=${newOrder}`
      )

      if (response.message === 'Message reordered successfully' || response.success !== false) {
        ElMessage.success('Message reordered successfully')
        return true
      } else {
        throw new Error(response.message || 'Failed to reorder message')
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to reorder message'
      error.value = errorMessage
      ElMessage.error(errorMessage)
      console.error('❌ Reorder message error:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get pinned messages for a conversation from local state
   */
  const getPinnedMessagesFromCache = (conversationId: string): IPinnedMessage[] => {
    return pinnedMessages.value.get(conversationId) || []
  }

  /**
   * Add a pinned message to local state (for real-time updates)
   */
  const addPinnedMessage = (conversationId: string, pinnedMessage: IPinnedMessage) => {
    const existing = pinnedMessages.value.get(conversationId) || []

    // Check if already exists
    const index = existing.findIndex(pm => pm.message.id === pinnedMessage.message.id)

    if (index === -1) {
      // Add new
      existing.push(pinnedMessage)
      // Sort by order
      existing.sort((a, b) => a.order - b.order)
      pinnedMessages.value.set(conversationId, existing)
      console.log(`✅ Added pinned message to cache:`, pinnedMessage.message.id)
    } else {
      // Update existing
      existing[index] = pinnedMessage
      pinnedMessages.value.set(conversationId, existing)
      console.log(`✅ Updated pinned message in cache:`, pinnedMessage.message.id)
    }
  }

  /**
   * Remove a pinned message from local state (for real-time updates)
   */
  const removePinnedMessage = (conversationId: string, messageId: string) => {
    const existing = pinnedMessages.value.get(conversationId) || []
    const filtered = existing.filter(pm => pm.message.id !== messageId)

    // Re-calculate order
    filtered.forEach((pm, index) => {
      pm.order = index
    })

    pinnedMessages.value.set(conversationId, filtered)
    console.log(`✅ Removed pinned message from cache:`, messageId)
  }

  /**
   * Update pinned message order in local state (for real-time updates)
   */
  const updatePinnedMessageOrder = (
    conversationId: string,
    messageId: string,
    newOrder: number
  ) => {
    const existing = pinnedMessages.value.get(conversationId) || []
    const messageIndex = existing.findIndex(pm => pm.message.id === messageId)

    if (messageIndex === -1) return

    // Remove from current position
    const [movedMessage] = existing.splice(messageIndex, 1)

    // Insert at new position
    if (movedMessage) {
      existing.splice(newOrder, 0, movedMessage)
    }

    // Update all orders
    existing.forEach((pm, index) => {
      pm.order = index
    })

    pinnedMessages.value.set(conversationId, existing)
    console.log(`✅ Updated pinned message order:`, messageId, 'to', newOrder)
  }

  /**
   * Clear pinned messages cache
   */
  const clearPinnedMessages = (conversationId?: string) => {
    if (conversationId) {
      pinnedMessages.value.delete(conversationId)
    } else {
      pinnedMessages.value.clear()
    }
  }

  return {
    // State
    pinnedMessages,
    isLoading,
    error,

    // Methods
    pinMessage,
    unpinMessage,
    getPinnedMessages,
    reorderPinnedMessage,
    getPinnedMessagesFromCache,
    addPinnedMessage,
    removePinnedMessage,
    updatePinnedMessageOrder,
    clearPinnedMessages
  }
}
