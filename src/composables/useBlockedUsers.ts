import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useApi } from './useApi'
import type { IFriendship } from '../interfaces/friendship.interface'

// State
const blockedUsers = ref<IFriendship[]>([])
const isLoading = ref(false)

export function useBlockedUsers() {
  const api = useApi()

  /**
   * Get list of blocked users
   * Returns only users that YOU have blocked (not users who blocked you)
   */
  const getBlockedUsers = async () => {
    isLoading.value = true
    try {
      const data = await api.get('/api/friendship/blocked')

      // API returns structure: { friends: [], totalFriends: 0, pendingRequests: [], totalPendingRequests: 0 }
      blockedUsers.value = data.friends || []

      return blockedUsers.value
    } catch (error: any) {
      console.error('Get blocked users error:', error)
      ElMessage.error(error.message || 'Failed to load blocked users')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Block a user
   * After blocking:
   * - They cannot find you in search
   * - They cannot send you friend requests
   * - You cannot send them friend requests
   * - Existing friendship will be removed
   *
   * @param userId - ID of the user to block
   */
  const blockUser = async (userId: string) => {
    if (!userId) {
      ElMessage.error('User ID is required')
      return false
    }

    isLoading.value = true
    try {
      const data = await api.post('/api/friendship/block', { userId })

      ElMessage.success('User blocked successfully')

      // Refresh blocked users list
      await getBlockedUsers()

      return data
    } catch (error: any) {
      console.error('Block user error:', error)

      // Handle specific error messages
      if (error.message.includes('Cannot block yourself')) {
        ElMessage.error('You cannot block yourself')
      } else if (error.message.includes('User not found')) {
        ElMessage.error('User not found')
      } else {
        ElMessage.error(error.message || 'Failed to block user')
      }

      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Unblock a user
   * After unblocking:
   * - They can find you in search
   * - They can send you friend requests
   * - You can send them friend requests
   *
   * @param userId - ID of the user to unblock
   */
  const unblockUser = async (userId: string) => {
    if (!userId) {
      ElMessage.error('User ID is required')
      return false
    }

    isLoading.value = true
    try {
      await api.del(`/api/friendship/unblock/${userId}`)

      ElMessage.success('User unblocked successfully')

      // Remove from local list
      blockedUsers.value = blockedUsers.value.filter(
        user => user.addresseeId !== userId && user.requesterId !== userId
      )

      return true
    } catch (error: any) {
      console.error('Unblock user error:', error)

      // Handle specific error messages
      if (error.message.includes('User is not blocked')) {
        ElMessage.error('User is not blocked')
      } else if (error.message.includes('User not found')) {
        ElMessage.error('User not found')
      } else {
        ElMessage.error(error.message || 'Failed to unblock user')
      }

      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Check if a user is blocked
   * @param userId - ID of the user to check
   */
  const isUserBlocked = (userId: string): boolean => {
    return blockedUsers.value.some(
      user => user.addresseeId === userId || user.requesterId === userId
    )
  }

  /**
   * Get count of blocked users
   */
  const getBlockedCount = (): number => {
    return blockedUsers.value.length
  }

  /**
   * Clear blocked users list (useful for logout)
   */
  const clearBlockedUsers = () => {
    blockedUsers.value = []
  }

  return {
    // State
    blockedUsers,
    isLoading,

    // Methods
    getBlockedUsers,
    blockUser,
    unblockUser,
    isUserBlocked,
    getBlockedCount,
    clearBlockedUsers
  }
}
