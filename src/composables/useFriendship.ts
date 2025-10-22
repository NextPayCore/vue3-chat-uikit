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
  IFriendshipNotification,
  FriendshipStatus
} from '../interfaces/friendship.interface'

// State
const friendsList = ref<IFriendUser[]>([])
const pendingRequests = ref<IFriendship[]>([])
const sentRequests = ref<IFriendship[]>([])
const blockedUsers = ref<IFriendUser[]>([])
const suggestedFriends = ref<ISuggestedFriend[]>([])
const isLoading = ref(false)
const latestNotification = ref<IFriendshipNotification | null>(null)

export function useFriendship() {
  const api = useApi()

  // Handler for friend request received event
  const onFriendRequestReceived = (data: IFriendshipNotification) => {
    console.log('🔔 Friend request received:', data)

    latestNotification.value = data

    // Add to pending requests
    const newRequest: IFriendship = {
      _id: data.friendshipId,
      requesterId: data.requester.id,
      addresseeId: data.addressee.id,
      status: 'pending',
      message: data.message,
      createdAt: data.createdAt,
      updatedAt: data.createdAt
    }

    pendingRequests.value.unshift(newRequest)

    // Show notification
    ElMessage({
      message: `${data.requester.name} sent you a friend request${data.message ? ': ' + data.message : ''}`,
      type: 'info',
      duration: 5000,
      showClose: true
    })

    // Optionally refresh full list
    getFriendshipList()
  }

  // Handler for friend request accepted event
  const onFriendRequestAccepted = (data: IFriendshipNotification) => {
    console.log('✅ Friend request accepted:', data)

    latestNotification.value = data

    // Remove from pending and add to friends
    pendingRequests.value = pendingRequests.value.filter(
      req => req._id !== data.friendshipId
    )

    // Add to friends list
    const newFriend: IFriendUser = {
      id: data.addressee.id,
      name: data.addressee.name,
      email: data.addressee.email,
      avatar: data.addressee.avatar,
      avatarUrl: data.addressee.avatar,
      isOnline: false,
      friendshipId: data.friendshipId
    }

    friendsList.value.unshift(newFriend)

    // Show success notification
    ElMessage({
      message: `${data.addressee.name} accepted your friend request!`,
      type: 'success',
      duration: 5000,
      showClose: true
    })

    // Refresh full list
    getFriendshipList()
  }

  // Handler for friend request declined event
  const onFriendRequestDeclined = (data: IFriendshipNotification) => {
    console.log('❌ Friend request declined:', data)

    latestNotification.value = data

    // Remove from pending requests
    pendingRequests.value = pendingRequests.value.filter(
      req => req._id !== data.friendshipId
    )

    // Show notification
    ElMessage({
      message: `${data.addressee.name} declined your friend request`,
      type: 'warning',
      duration: 5000,
      showClose: true
    })
  }

  // Helper: Extract user info from serialized string
  const extractUserFromString = (serializedUser: string): Partial<IFriendUser> => {
    if (!serializedUser || typeof serializedUser !== 'string') {
      return {}
    }

    const idMatch = serializedUser.match(/_id:\s*new\s+ObjectId\('([^']+)'\)/)
    const nameMatch = serializedUser.match(/name:\s*['"]([^'"]+)['"]/)
    const emailMatch = serializedUser.match(/email:\s*['"]([^'"]+)['"]/)
    const avatarMatch = serializedUser.match(/avatar:\s*['"]([^'"]+)['"]/)

    return {
      id: idMatch?.[1] || undefined,
      name: nameMatch?.[1] || undefined,
      email: emailMatch?.[1] || undefined,
      avatar: avatarMatch?.[1] || undefined,
      avatarUrl: avatarMatch?.[1] || undefined,
      isOnline: false
    }
  }

  // Helper: Transform friendship object to user object
  const transformFriendshipToUser = (friendship: any, currentUserId: string): IFriendUser => {
    // Determine which user is the friend (not current user)
    let friendData: Partial<IFriendUser> = {}

    // Extract user info from requesterId or addresseeId
    const requesterInfo = typeof friendship.requesterId === 'string'
      ? extractUserFromString(friendship.requesterId)
      : friendship.requesterId

    const addresseeInfo = typeof friendship.addresseeId === 'string'
      ? extractUserFromString(friendship.addresseeId)
      : friendship.addresseeId

    // Find which one is the friend (not current user)
    if (requesterInfo.id === currentUserId) {
      friendData = addresseeInfo
    } else {
      friendData = requesterInfo
    }

    return {
      id: friendData.id || friendship.id || 'unknown',
      name: friendData.name || 'Unknown User',
      email: friendData.email || '',
      avatar: friendData.avatar,
      avatarUrl: friendData.avatarUrl || friendData.avatar,
      isOnline: friendData.isOnline || false,
      lastSeen: friendData.lastSeen,
      friendshipId: friendship.id || friendship._id
    }
  }

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
    // Check if user has valid token before making API call
    if (!api.hasValidToken()) {
      console.log('⚠️ No valid auth token, skipping friendship list fetch')
      return null
    }

    isLoading.value = true
    try {
      // Call the API endpoint that returns just IDs
      const data = await api.getFriendshipList()

      console.log('📋 Friendship list response:', data)

      // Get current user ID
      const currentUser = localStorage.getItem('auth_user')
      const currentUserId = currentUser ? JSON.parse(currentUser).id : null

      // Fetch user details for friends (if we have any)
      if (data.friends && data.friends.length > 0) {
        // Check if friends is array of strings (IDs) or objects
        if (typeof data.friends[0] === 'string') {
          // Array of user IDs
          friendsList.value = await fetchUserDetails(data.friends as string[])
        } else if ((data.friends[0] as any).requesterId !== undefined) {
          // Array of friendship objects - need to transform to user objects
          friendsList.value = (data.friends as any[]).map(friendship =>
            transformFriendshipToUser(friendship, currentUserId)
          )
        } else {
          // Already full user objects
          friendsList.value = (data.friends as unknown) as IFriendUser[]
        }
      } else {
        friendsList.value = []
      }

      // Handle pending requests - backend might return IDs or full objects
      if (data.pendingRequests && data.pendingRequests.length > 0) {
        if (typeof data.pendingRequests[0] === 'string') {
          // If backend returns array of IDs, convert to mock objects
          pendingRequests.value = data.pendingRequests.map((id) => ({
            _id: id,
            requesterId: id,
            addresseeId: 'current-user',
            status: 'pending' as FriendshipStatus,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        } else {
          // Backend returns full objects, use them directly
          pendingRequests.value = (data.pendingRequests as any[]).map((req) => ({
            _id: req.id || req._id,
            requesterId: req.requesterId,
            addresseeId: req.addresseeId,
            status: req.status || 'pending',
            message: req.message,
            createdAt: req.createdAt,
            updatedAt: req.updatedAt
          }))
        }
      } else {
        pendingRequests.value = []
      }

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

      // Check if it's an authentication error
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        console.warn('⚠️ Authentication failed, token may be expired')
        // Clear invalid token
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        // Don't show error message, user will be prompted to login again
      } else {
        ElMessage.error(error.message || 'Failed to load friends')
      }

      return null
    } finally {
      isLoading.value = false
    }
  }

  // Send friend request
  const sendFriendRequest = async (addresseeId: string, message?: string) => {
    isLoading.value = true
    try {
      const data = await api.post('/api/friendship/send-request', {
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
    console.log('📤 [useFriendship] Responding to request:', {
      friendshipId,
      status,
      type: typeof friendshipId
    })

    isLoading.value = true
    try {
      const payload = {
        friendshipId,
        status
      }

      console.log('📤 [useFriendship] Request payload:', payload)

      const data = await api.post('/api/friendship/respond-request', payload)

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
      const data = await api.post('/api/friendship/block', {
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
      const data = await api.del(`/api/friendship/unblock/${userId}`)

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
      const data = await api.del(`/api/friendship/remove/${friendId}`)

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
      return await api.get(`/api/friendship/check/${userId}`)
    } catch (error: any) {
      console.error('Check friendship error:', error)
      throw error
    }
  }

  // Get suggested friends
  const getSuggestedFriends = async () => {
    isLoading.value = true
    try {
      const data = await api.get('/api/friendship/suggested-friends')
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
    latestNotification,

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
    getSuggestedFriends,

    // Socket event handlers
    onFriendRequestReceived,
    onFriendRequestAccepted,
    onFriendRequestDeclined
  }
}
