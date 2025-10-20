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
const userCache = ref<Map<string, any>>(new Map()) // Cache for user details

export function useConversation() {
  const api = useApi()

  // Enrich conversations with user details from cache (friends list, messages, etc.)
  const enrichConversationsWithUserDetails = (userMap: Map<string, any>) => {
    userCache.value = userMap

    // Update all conversations with cached user details
    conversations.value = conversations.value.map(conv => {
      const enrichedParticipants = conv.participants.map(participant => {
        const cachedUser = userCache.value.get(participant.id)
        if (cachedUser) {
          return {
            ...participant,
            name: cachedUser.name || participant.name,
            email: cachedUser.email || participant.email,
            avatarUrl: cachedUser.avatarUrl || cachedUser.avatar || participant.avatarUrl,
            isOnline: cachedUser.isOnline || participant.isOnline
          }
        }
        return participant
      })

      return {
        ...conv,
        participants: enrichedParticipants
      }
    })
  }

  // Get all conversations
  const getConversations = async (page = 1, limit = 50) => {
    isLoading.value = true
    try {
      const data = await api.get(
        `/api/chat/conversations?page=${page}&limit=${limit}`
      )

      // Handle both response formats:
      // 1. Array format: [{...}, {...}] (current backend)
      // 2. Object format: {conversations: [...], total: ..., page: ..., limit: ...}
      let conversationsList: any[] = []

      if (Array.isArray(data)) {
        conversationsList = data
      } else {
        conversationsList = data.conversations || []
      }

      // Adapt backend response to match IConversation interface
      // Backend returns: {id, type, participants: string[], createdBy: string, ...}
      // Frontend expects: {_id, type, participants: IUser[], participantIds: string[], ...}
      //
      // ⚠️ NOTE: Backend does NOT populate participants, so we create placeholder user objects
      // The actual user names will be loaded when we fetch friends list or messages
      const adaptedConversations = conversationsList.map((conv: any) => {
        // Create placeholder user objects from participant IDs
        let participantUsers = []
        if (conv.participants && conv.participants.length > 0) {
          if (typeof conv.participants[0] === 'string') {
            // Participants are IDs, create minimal user objects
            // These will be enriched later when we have user data from other sources
            participantUsers = conv.participants.map((userId: string) => ({
              id: userId,
              name: userId.substring(0, 8) + '...', // Temporary: show part of ID
              email: '',
              avatarUrl: '',
              isOnline: false
            }))
          } else {
            // Participants are already populated (rare case)
            participantUsers = conv.participants
          }
        }

        return {
          _id: conv.id || conv._id,
          type: conv.type,
          name: conv.name,
          description: conv.description,
          avatar: conv.avatar,
          participants: participantUsers,
          participantIds: conv.participants || [],
          createdBy: typeof conv.createdBy === 'string' ? conv.createdBy : conv.createdBy?.id,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : new Date(conv.updatedAt),
          unreadCount: conv.unreadCount || 0,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          metadata: {
            isActive: conv.isActive ?? true,
            isMuted: false,
            isPinned: false
          }
        } as IConversation
      })

      conversations.value = adaptedConversations

      return {
        conversations: adaptedConversations,
        total: adaptedConversations.length,
        page,
        limit,
        hasMore: false
      } as IConversationListResponse
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
    userCache,

    // Computed
    privateConversations,
    groupConversations,
    totalConversations,

    // Methods
    getConversations,
    createConversation,
    getConversation,
    deleteConversation,
    setActiveConversation,
    enrichConversationsWithUserDetails
  }
}
