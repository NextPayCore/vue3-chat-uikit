import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type {
  IFriendship,
  IFriendUser,
  IFriendshipList,
  ISuggestedFriend,
  IFriendshipCheckResponse,
  FriendshipStatus
} from '../interfaces/friendship.interface'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

// State
const friendsList = ref<IFriendUser[]>([])
const pendingRequests = ref<IFriendship[]>([])
const sentRequests = ref<IFriendship[]>([])
const blockedUsers = ref<IFriendUser[]>([])
const suggestedFriends = ref<ISuggestedFriend[]>([])
const isLoading = ref(false)

export function useFriendship() {
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  }

  // Get friendship list
  const getFriendshipList = async () => {
    isLoading.value = true
    try {
      const response = await fetch(`${apiBaseUrl}/friendship/list`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error('Failed to fetch friendship list')
      }

      const data: IFriendshipList = await response.json()
      friendsList.value = data.friends
      pendingRequests.value = data.pendingRequests
      sentRequests.value = data.sentRequests
      blockedUsers.value = data.blockedUsers

      return data
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
      const response = await fetch(`${apiBaseUrl}/friendship/send-request`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ addresseeId, message })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send friend request')
      }

      const data = await response.json()

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
      const response = await fetch(`${apiBaseUrl}/friendship/respond-request`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ friendshipId, status })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to respond to request')
      }

      const data = await response.json()

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
      const response = await fetch(`${apiBaseUrl}/friendship/block`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, reason })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to block user')
      }

      const data = await response.json()

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
      const response = await fetch(`${apiBaseUrl}/friendship/unblock/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to unblock user')
      }

      const data = await response.json()

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
      const response = await fetch(`${apiBaseUrl}/friendship/remove/${friendId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to remove friend')
      }

      const data = await response.json()

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
      const response = await fetch(`${apiBaseUrl}/friendship/check/${userId}`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error('Failed to check friendship status')
      }

      return await response.json()
    } catch (error: any) {
      console.error('Check friendship error:', error)
      throw error
    }
  }

  // Get suggested friends
  const getSuggestedFriends = async () => {
    isLoading.value = true
    try {
      const response = await fetch(`${apiBaseUrl}/friendship/suggested-friends`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        throw new Error('Failed to fetch suggested friends')
      }

      const data = await response.json()
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
