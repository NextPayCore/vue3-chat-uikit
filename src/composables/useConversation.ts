import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useApi } from './useApi'
import type {
  IConversation,
  ICreateConversationRequest,
  IConversationListResponse
} from '../interfaces/conversation.interface'

// State
const conversations = ref<IConversation[]>([])
const activeConversation = ref<IConversation | null>(null)
const isLoading = ref(false)

export function useConversation() {
  const api = useApi()

  // Get all conversations
  const getConversations = async (page = 1, limit = 50) => {
    isLoading.value = true
    try {
      const data: IConversationListResponse = await api.get(
        `/api/chat/conversations?page=${page}&limit=${limit}`
      )

      conversations.value = data.conversations

      return data
    } catch (error: any) {
      console.error('Get conversations error:', error)
      ElMessage.error(error.message || 'Failed to load conversations')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Create conversation (private or group)
  const createConversation = async (request: ICreateConversationRequest) => {
    isLoading.value = true
    try {
      // Validate
      if (request.type === 'group' && request.participantIds.length < 2) {
        throw new Error('Group conversations must have at least 3 participants (including you)')
      }

      const data = await api.post('/api/chat/conversations', request)

      ElMessage.success(
        request.type === 'private'
          ? 'Chat created successfully'
          : 'Group chat created successfully'
      )

      // Refresh conversations list
      await getConversations()

      return data.conversation
    } catch (error: any) {
      console.error('Create conversation error:', error)

      // Handle specific errors
      if (error.message.includes('only chat with your friends')) {
        ElMessage.error('You can only chat with your friends')
      } else if (error.message.includes('at least 3 participants')) {
        ElMessage.error('Group chats need at least 3 people')
      } else if (error.message.includes('only add friends')) {
        ElMessage.error('You can only add friends to group chats')
      } else {
        ElMessage.error(error.message || 'Failed to create conversation')
      }

      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Get conversation by ID
  const getConversation = async (conversationId: string) => {
    try {
      return await api.get(`/api/chat/conversations/${conversationId}`)
    } catch (error: any) {
      console.error('Get conversation error:', error)
      ElMessage.error(error.message || 'Failed to load conversation')
      throw error
    }
  }

  // Delete conversation
  const deleteConversation = async (conversationId: string) => {
    isLoading.value = true
    try {
      await api.del(`/api/chat/conversations/${conversationId}`)

      ElMessage.success('Conversation deleted')

      // Remove from list
      conversations.value = conversations.value.filter(c => c._id !== conversationId)
      if (activeConversation.value?._id === conversationId) {
        activeConversation.value = null
      }

      return true
    } catch (error: any) {
      console.error('Delete conversation error:', error)
      ElMessage.error(error.message || 'Failed to delete conversation')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Set active conversation
  const setActiveConversation = (conversation: IConversation | null) => {
    activeConversation.value = conversation
  }

  // Computed
  const privateConversations = computed(() =>
    conversations.value.filter(c => c.type === 'private')
  )

  const groupConversations = computed(() =>
    conversations.value.filter(c => c.type === 'group')
  )

  const totalConversations = computed(() => conversations.value.length)

  return {
    // State
    conversations,
    activeConversation,
    isLoading,

    // Computed
    privateConversations,
    groupConversations,
    totalConversations,

    // Methods
    getConversations,
    createConversation,
    getConversation,
    deleteConversation,
    setActiveConversation
  }
}
