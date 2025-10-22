import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useApi } from './useApi'
import type {
  IConversation,
  ICreateConversationRequest,
  IConversationListResponse
} from '../interfaces/conversation.interface'
import {
  parseParticipants,
  enrichUsersWithCache,
  extractParticipantIds,
  parseCreatedByUser
} from '../utils/conversationParser'

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
      const enrichedParticipants = enrichUsersWithCache(conv.participants, userCache.value)

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
      console.log('✅ Fetched conversations data:', data);

      // Handle both response formats:
      // 1. Array format: [{...}, {...}] (current backend)
      // 2. Object format: {conversations: [...], total: ..., page: ..., limit: ...}
      let conversationsList: any[] = []

      if (Array.isArray(data)) {
        conversationsList = data
      } else {
        conversationsList = data.conversations || []
      }
      const adaptedConversations = conversationsList.map((conv: any) => {
        // Parse participants using utility function
        let participantUsers = parseParticipants(conv.participants || [])

        // Parse createdBy from MongoDB toString format
        const createdByUser = typeof conv.createdBy === 'string'
          ? parseCreatedByUser(conv.createdBy)
          : null

        // Enrich participants for private chats using multiple sources
        if (conv.type === 'private') {
          const participantsMap = new Map<string, any>()

          // 1. Start with ALL participant IDs from backend (ensures we have both users)
          conv.participants.forEach((id: string) => {
            if (!participantsMap.has(id)) {
              // Create placeholder with ID
              participantsMap.set(id, {
                id,
                name: id.substring(0, 8) + '...',
                email: '',
                avatarUrl: '',
                isOnline: false
              })
            }
          })

          // 2. Enrich with lastMessage.sender (might be current user or other user)
          if (conv.lastMessage?.sender?.id) {
            participantsMap.set(conv.lastMessage.sender.id, {
              id: conv.lastMessage.sender.id,
              name: conv.lastMessage.sender.name,
              email: conv.lastMessage.sender.email || '',
              avatarUrl: conv.lastMessage.sender.avatar || '',
              isOnline: false
            })
          }

          // 3. Enrich with createdBy (might be current user or other user)
          if (createdByUser && !participantsMap.has(createdByUser.id)) {
            participantsMap.set(createdByUser.id, createdByUser)
          }

          // 4. Enrich from userCache (friends list, etc.)
          conv.participants.forEach((id: string) => {
            const cachedUser = userCache.value.get(id)
            if (cachedUser) {
              participantsMap.set(id, {
                id,
                name: cachedUser.name || cachedUser.username || participantsMap.get(id)?.name,
                email: cachedUser.email || participantsMap.get(id)?.email || '',
                avatarUrl: cachedUser.avatarUrl || cachedUser.avatar || participantsMap.get(id)?.avatarUrl || '',
                isOnline: cachedUser.isOnline || false
              })
            }
          })

          // Convert back to array
          participantUsers = Array.from(participantsMap.values())

          // Log for debugging
          console.log(`📋 Conversation ${conv.id} participants:`, {
            originalIds: conv.participants,
            enrichedCount: participantUsers.length,
            participants: participantUsers.map(p => ({ id: p.id, name: p.name }))
          })
        }

        return {
          _id: conv.id || conv._id,
          type: conv.type,
          name: conv.name,
          description: conv.description,
          avatar: conv.avatar,
          participants: participantUsers,
          participantIds: extractParticipantIds(conv.participants || []),
          createdBy: conv.createdBy,
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

  // Get detailed conversations with full participant info
  const getDetailedConversations = async (options?: {
    query?: string
    page?: number
    limit?: number
    type?: 'private' | 'group'
    sortBy?: 'createdAt' | 'updatedAt' | 'name'
    sortOrder?: 'asc' | 'desc'
  }) => {
    isLoading.value = true
    try {
      const response = await api.getDetailedConversations(options)
      console.log('✅ Fetched detailed conversations:', response)

      // Map response to our format
      const adaptedConversations = response.conversations.map((conv: any) => {
        // Use participantsInfo if available, otherwise parse participants
        let participantUsers = conv.participantsInfo
          ? conv.participantsInfo.map((p: any) => ({
              id: p.id,
              name: p.name,
              email: p.email,
              avatarUrl: p.avatar,
              isOnline: conv.presenceInfo?.onlineUsers?.includes(p.id) || false
            }))
          : parseParticipants(conv.participants || [])

        console.log(`📋 Conversation ${conv.id || conv._id} participants:`, {
          originalIds: conv.participants,
          participantsInfo: conv.participantsInfo,
          enrichedCount: participantUsers.length,
          participants: participantUsers.map((p: any) => ({ id: p.id, name: p.name }))
        })

        return {
          _id: conv.id || conv._id,
          type: conv.type,
          name: conv.name,
          description: conv.description,
          avatar: conv.avatar,
          participants: participantUsers,
          participantIds: conv.participants || [],
          participantsInfo: conv.participantsInfo,
          creatorInfo: conv.creatorInfo,
          participantCount: conv.participantCount,
          presenceInfo: conv.presenceInfo,
          createdBy: conv.createdBy,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt) : undefined,
          unreadCount: conv.unreadCount,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          metadata: {
            isActive: conv.isActive ?? true,
            isMuted: conv.metadata?.isMuted,
            mutedUntil: conv.metadata?.mutedUntil,
            isPinned: conv.metadata?.isPinned
          }
        } as IConversation
      })

      conversations.value = adaptedConversations

      return {
        conversations: adaptedConversations,
        total: response.totalConversations,
        page: response.page,
        limit: response.limit,
        hasMore: response.page < response.totalPages
      } as IConversationListResponse
    } catch (error: any) {
      console.error('Get detailed conversations error:', error)
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
    console.log('🎯 Setting active conversation:', conversation?._id, conversation)
    activeConversation.value = conversation
    console.log('✅ Active conversation set. Current value:', activeConversation.value?._id)
  }

  // Update conversation's last message (for socket events)
  const updateConversationLastMessage = (
    conversationId: string,
    lastMessage: any,
    lastMessageAt?: Date
  ) => {
    const conversation = conversations.value.find(c => c._id === conversationId)
    if (conversation) {
      conversation.lastMessage = lastMessage
      conversation.lastMessageAt = lastMessageAt || new Date()

      // Move to top of list (sort by lastMessageAt)
      conversations.value.sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
        return timeB - timeA
      })

      console.log('✅ Conversation last message updated:', conversationId)
    }
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
    getDetailedConversations,
    createConversation,
    getConversation,
    deleteConversation,
    setActiveConversation,
    enrichConversationsWithUserDetails,
    updateConversationLastMessage
  }
}
