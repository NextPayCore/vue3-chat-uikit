import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useApi, type FriendshipListResponse } from './useApi'
import type {
  IFriendship,
  IFriendUser,
  IFriendshipList,
  IFriendshipListSimple,
  ISuggestedFriend,
  IFriendshipCheckResponse,
  FriendshipStatus
} from '../interfaces/friendship.interface'

// State
const friendsList = ref<IFriendUser[]>([])
const pendingRequests = ref<IFriendship[]>([])
const sentRequests = ref<IFriendship[]>([])
const blockedUsers = ref<IFriendUser[]>([])
const suggestedFriends = ref<ISuggestedFriend[]>([])
const isLoading = ref(false)

export function useFriendship() {
  const api = useApi()

  // Helper: Fetch user details from user IDs
  const fetchUserDetails = async (userIds: string[]): Promise<IFriendUser[]> => {
    try {
      // Fetch all user details in parallel
      const userDetails = await Promise.all(
        userIds.map(async (id) => {
          try {
            const user = await api.getUserById(id)
            return {
              id: user.id,
              name: user.name,
              email: user.email || '',
              avatarUrl: user.avatarUrl,
              isOnline: user.isOnline || false,
              lastSeen: user.lastActiveAt
            }
          } catch (error) {
            console.error(`Failed to fetch user ${id}:`, error)
            // Return mock data if fetch fails
            return {
              id,
              name: `User ${id.substring(0, 8)}`,
              email: '',
              avatarUrl: `https://i.pravatar.cc/150?u=${id}`,
              isOnline: false
            }
          }
        })
      )
      return userDetails
    } catch (error) {
      console.error('Error fetching user details:', error)
      return []
    }
  }

  // Get friendship list
  const getFriendshipList = async () => {
    isLoading.value = true
    try {
      // Call the API endpoint that returns just IDs
      const data = await api.getFriendshipList()

      console.log('📋 Friendship list response:', data)

      // Fetch user details for friends (if we have any)
      if (data.friends.length > 0) {
        friendsList.value = await fetchUserDetails(data.friends)
      } else {
        friendsList.value = []
      }

      // Convert request IDs to mock objects (until backend provides full request details)
      pendingRequests.value = data.pendingRequests.map((id, index) => ({
        _id: id,
        requesterId: id,
        addresseeId: 'current-user',
        status: 'pending' as FriendshipStatus,
        message: 'Hi! Let\'s be friends!',
        createdAt: new Date(Date.now() - Math.random() * 86400000 * 7),
        updatedAt: new Date()
      }))

      // TODO: When backend provides full request objects, use them directly
      // pendingRequests.value = data.pendingRequests

      sentRequests.value = []
      blockedUsers.value = []

      return {
        friends: friendsList.value,
        pendingRequests: pendingRequests.value,
        sentRequests: sentRequests.value,
        blockedUsers: blockedUsers.value,
        totalFriends: data.totalFriends,
        totalPending: data.totalPendingRequests,
        totalBlocked: 0
      }
    } catch (error: any) {
      console.error('Get friendship list error:', error)
      ElMessage.error(error.message || 'Failed to load friends')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Send friend request
  const sendFriendRequest = async (addresseeId: string, message?: string) => {
    isLoading.value = true
    try {
      const data = await api.post('/friendship/send-request', {
        addresseeId,
        message
      })

      ElMessage.success('Friend request sent successfully')
      await getFriendshipList() // Refresh list

      return data
    } catch (error: any) {
      console.error('Send friend request error:', error)
      ElMessage.error(error.message || 'Failed to send friend request')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Respond to friend request (accept/decline)
  const respondToRequest = async (
    friendshipId: string,
    status: 'accepted' | 'declined'
  ) => {
    isLoading.value = true
    try {
      const data = await api.post('/friendship/respond-request', {
        friendshipId,
        status
      })

      ElMessage.success(
        status === 'accepted' ? 'Friend request accepted' : 'Friend request declined'
      )
      await getFriendshipList() // Refresh list

      return data
    } catch (error: any) {
      console.error('Respond to request error:', error)
      ElMessage.error(error.message || 'Failed to respond to request')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Block user
  const blockUser = async (userId: string, reason?: string) => {
    isLoading.value = true
    try {
      const data = await api.post('/friendship/block', {
        userId,
        reason
      })

      ElMessage.success('User blocked successfully')
      await getFriendshipList() // Refresh list

      return data
    } catch (error: any) {
      console.error('Block user error:', error)
      ElMessage.error(error.message || 'Failed to block user')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Unblock user
  const unblockUser = async (userId: string) => {
    isLoading.value = true
    try {
      const data = await api.del(`/friendship/unblock/${userId}`)

      ElMessage.success('User unblocked successfully')
      await getFriendshipList() // Refresh list

      return data
    } catch (error: any) {
      console.error('Unblock user error:', error)
      ElMessage.error(error.message || 'Failed to unblock user')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Remove friend
  const removeFriend = async (friendId: string) => {
    isLoading.value = true
    try {
      const data = await api.del(`/friendship/remove/${friendId}`)

      ElMessage.success('Friend removed successfully')
      await getFriendshipList() // Refresh list

      return data
    } catch (error: any) {
      console.error('Remove friend error:', error)
      ElMessage.error(error.message || 'Failed to remove friend')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Check friendship status
  const checkFriendship = async (userId: string): Promise<IFriendshipCheckResponse> => {
    try {
      return await api.get(`/friendship/check/${userId}`)
    } catch (error: any) {
      console.error('Check friendship error:', error)
      throw error
    }
  }

  // Get suggested friends
  const getSuggestedFriends = async () => {
    isLoading.value = true
    try {
      const data = await api.get('/friendship/suggested-friends')
      suggestedFriends.value = data.suggestions || []

      return data
    } catch (error: any) {
      console.error('Get suggested friends error:', error)
      ElMessage.error(error.message || 'Failed to load suggested friends')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Computed
  const totalFriends = computed(() => friendsList.value.length)
  const totalPendingRequests = computed(() => pendingRequests.value.length)
  const totalSentRequests = computed(() => sentRequests.value.length)
  const totalBlockedUsers = computed(() => blockedUsers.value.length)
  const hasPendingRequests = computed(() => totalPendingRequests.value > 0)

  return {
    // State
    friendsList,
    pendingRequests,
    sentRequests,
    blockedUsers,
    suggestedFriends,
    isLoading,

    // Computed
    totalFriends,
    totalPendingRequests,
    totalSentRequests,
    totalBlockedUsers,
    hasPendingRequests,

    // Methods
    getFriendshipList,
    sendFriendRequest,
    respondToRequest,
    blockUser,
    unblockUser,
    removeFriend,
    checkFriendship,
    getSuggestedFriends
  }
}
