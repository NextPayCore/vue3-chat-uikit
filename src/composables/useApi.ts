import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { IUser } from '../interfaces/user.interface'
import type { IMessage } from '../interfaces/message.interface'
import type { IConversation } from '../interfaces/conversation.interface'
import type { IFriendship } from '../interfaces/friendship.interface'

export interface ApiConfig {
  baseUrl?: string
  timeout?: number
  headers?: Record<string, string>
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T = any> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SearchUsersResponse {
  users: IUser[]
  totalUsers: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface FriendshipListResponse {
  friends: string[]
  totalFriends: number
  pendingRequests: string[]
  totalPendingRequests: number
}

export function useApi(config?: ApiConfig) {
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  // Get base URL from config or environment variable
  const baseUrl = config?.baseUrl || import.meta.env.VITE_API_BASE_URL || ''
  const timeout = config?.timeout || 30000

  // Get auth token from localStorage
  const getAuthToken = (): string | null => {
    return localStorage.getItem('accessToken')
  }

  // Check if user has valid token
  const hasValidToken = (): boolean => {
    const token = getAuthToken()
    if (!token) return false

    try {
      // Decode JWT to check expiration
      const parts = token.split('.')
      if (parts.length !== 3 || !parts[1]) return false

      const payload = JSON.parse(atob(parts[1]))
      const exp = payload.exp * 1000 // Convert to milliseconds
      const now = Date.now()

      // Check if token is expired
      if (exp < now) {
        console.warn('⚠️ Token expired')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to validate token:', error)
      return false
    }
  }

  // Create request headers
  const createHeaders = (customHeaders?: Record<string, string>): HeadersInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config?.headers,
      ...customHeaders,
    }

    const token = getAuthToken()
    console.log('🔍 [useApi] Token exists:', !!token, token ? `(${token.substring(0, 20)}...)` : '')

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
      console.log('✅ [useApi] Authorization header added')
    } else {
      console.warn('⚠️ [useApi] No token found - request will fail with 401')
    }

    console.log('📤 [useApi] Request headers:', Object.keys(headers))
    return headers
  }

  // Generic fetch wrapper with error handling
  const fetchWithTimeout = async <T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${baseUrl}${url}`, {
        ...options,
        signal: controller.signal,
        headers: createHeaders(options.headers as Record<string, string>),
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`

        // Handle 401 Unauthorized - clear auth data
        if (response.status === 401) {
          console.warn('⚠️ Authentication failed (401), clearing auth data')
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')

          // // Reload page to show login modal
          // setTimeout(() => {
          //   window.location.reload()
          // }, 1000)
        }

        throw new Error(errorMessage)
      }

      const data = await response.json()
      return data as T
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      throw err
    }
  }

  // Generic request handler
  const request = async <T = any>(
    method: string,
    url: string,
    body?: any,
    customHeaders?: Record<string, string>
  ): Promise<T> => {
    isLoading.value = true
    error.value = null

    try {
      const options: RequestInit = {
        method,
        headers: customHeaders,
      }

      if (body) {
        options.body = JSON.stringify(body)
      }

      const data = await fetchWithTimeout<T>(url, options)
      return data
    } catch (err: any) {
      error.value = err
      console.error(`API ${method} ${url} error:`, err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // HTTP methods
  const get = async <T = any>(url: string, headers?: Record<string, string>): Promise<T> => {
    return request<T>('GET', url, undefined, headers)
  }

  const post = async <T = any>(url: string, body?: any, headers?: Record<string, string>): Promise<T> => {
    return request<T>('POST', url, body, headers)
  }

  const put = async <T = any>(url: string, body?: any, headers?: Record<string, string>): Promise<T> => {
    return request<T>('PUT', url, body, headers)
  }

  const patch = async <T = any>(url: string, body?: any, headers?: Record<string, string>): Promise<T> => {
    return request<T>('PATCH', url, body, headers)
  }

  const del = async <T = any>(url: string, headers?: Record<string, string>): Promise<T> => {
    return request<T>('DELETE', url, undefined, headers)
  }

  // === USER APIs ===

  // Get current user profile
  const getCurrentUser = async (): Promise<IUser> => {
    return get<IUser>('/api/users/me')
  }

  // Get user by ID
  const getUserById = async (userId: string): Promise<IUser> => {
    return get<IUser>(`/api/users/${userId}`)
  }

  // Update user profile
  const updateUserProfile = async (userId: string, data: Partial<IUser>): Promise<IUser> => {
    return put<IUser>(`/api/users/${userId}`, data)
  }

  // Search users
  const searchUsers = async (query: string, page = 1, pageSize = 20): Promise<PaginatedResponse<IUser>> => {
    return get<PaginatedResponse<IUser>>(`/api/users/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`)
  }

  // Search users for friendship (excludes current user and existing friends)
  const searchUsersForFriendship = async (
    query: string,
    page = 1,
    limit = 20,
    options?: {
      excludeCurrentUser?: boolean
      excludeFriends?: boolean
    }
  ): Promise<SearchUsersResponse> => {
    const params = new URLSearchParams({
      query,
      page: page.toString(),
      limit: limit.toString(),
      excludeCurrentUser: (options?.excludeCurrentUser ?? true).toString(),
      excludeFriends: (options?.excludeFriends ?? true).toString()
    })

    return get<SearchUsersResponse>(`/api/friendship/search-users?${params.toString()}`)
  }

  // Get online users
  const getOnlineUsers = async (): Promise<IUser[]> => {
    return get<IUser[]>('/api/users/online')
  }

  // === CONVERSATION APIs ===

  // Get all conversations for current user
  const getConversations = async (page = 1, pageSize = 20): Promise<PaginatedResponse<IConversation>> => {
    return get<PaginatedResponse<IConversation>>(`/api/conversations?page=${page}&pageSize=${pageSize}`)
  }

  // Get conversation by ID
  const getConversationById = async (conversationId: string): Promise<IConversation> => {
    return get<IConversation>(`/api/conversations/${conversationId}`)
  }

  // Create new conversation
  const createConversation = async (data: {
    participants: string[]
    type?: 'private' | 'group'
    name?: string
  }): Promise<IConversation> => {
    return post<IConversation>('/api/conversations', data)
  }

  // Update conversation
  const updateConversation = async (
    conversationId: string,
    data: Partial<IConversation>
  ): Promise<IConversation> => {
    return put<IConversation>(`/api/conversations/${conversationId}`, data)
  }

  // Delete conversation
  const deleteConversation = async (conversationId: string): Promise<void> => {
    return del<void>(`/api/conversations/${conversationId}`)
  }

  // Add participant to conversation
  const addParticipant = async (conversationId: string, userId: string): Promise<IConversation> => {
    return post<IConversation>(`/api/conversations/${conversationId}/participants`, { userId })
  }

  // Remove participant from conversation
  const removeParticipant = async (conversationId: string, userId: string): Promise<IConversation> => {
    return del<IConversation>(`/api/conversations/${conversationId}/participants/${userId}`)
  }

  // === MESSAGE APIs ===

  // Get messages for a conversation
  const getMessages = async (
    conversationId: string,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedResponse<IMessage>> => {
    return get<PaginatedResponse<IMessage>>(
      `/api/conversations/${conversationId}/messages?page=${page}&pageSize=${pageSize}`
    )
  }

  // Get message by ID
  const getMessageById = async (messageId: string): Promise<IMessage> => {
    return get<IMessage>(`/api/messages/${messageId}`)
  }

  // Send message
  const sendMessage = async (data: {
    conversationId: string
    content: string
    type?: 'text' | 'image' | 'file' | 'video' | 'audio'
    replyTo?: string
    metadata?: Record<string, any>
  }): Promise<IMessage> => {
    return post<IMessage>('/api/messages', data)
  }

  // Update message
  const updateMessage = async (messageId: string, data: { content: string }): Promise<IMessage> => {
    return put<IMessage>(`/api/messages/${messageId}`, data)
  }

  // Delete message
  const deleteMessage = async (messageId: string): Promise<void> => {
    return del<void>(`/api/messages/${messageId}`)
  }

  // Mark message as read
  const markMessageAsRead = async (messageId: string): Promise<void> => {
    return post<void>(`/api/messages/${messageId}/read`)
  }

  // Mark messages as delivered
  const markMessagesAsDelivered = async (messageIds: string[]): Promise<void> => {
    return post<void>('/api/messages/delivered', { messageIds })
  }

  // === FRIENDSHIP APIs ===

  // Get friendship list (friends and pending requests)
  const getFriendshipList = async (): Promise<FriendshipListResponse> => {
    return get<FriendshipListResponse>('/api/friendship/list')
  }

  // Get all friends
  const getFriends = async (page = 1, pageSize = 50): Promise<PaginatedResponse<IFriendship>> => {
    return get<PaginatedResponse<IFriendship>>(`/api/friends?page=${page}&pageSize=${pageSize}`)
  }

  // Get friend requests
  const getFriendRequests = async (): Promise<IFriendship[]> => {
    return get<IFriendship[]>('/api/friends/requests')
  }

  // Send friend request
  const sendFriendRequest = async (userId: string): Promise<IFriendship> => {
    return post<IFriendship>('/api/friends/request', { userId })
  }

  // Send friend request (alternative endpoint)
  const sendFriendshipRequest = async (addresseeId: string): Promise<IFriendship> => {
    return post<IFriendship>('/api/friendship/send-request', { addresseeId })
  }

  // Accept friend request
  const acceptFriendRequest = async (friendshipId: string): Promise<IFriendship> => {
    return post<IFriendship>(`/api/friends/${friendshipId}/accept`)
  }

  // Accept friend request (alternative endpoint using userId)
  const acceptFriendshipRequest = async (userId: string): Promise<IFriendship> => {
    return post<IFriendship>('/api/friendship/accept-request', { userId })
  }

  // Reject friend request
  const rejectFriendRequest = async (friendshipId: string): Promise<void> => {
    return post<void>(`/api/friends/${friendshipId}/reject`)
  }

  // Reject friend request (alternative endpoint using userId)
  const rejectFriendshipRequest = async (userId: string): Promise<void> => {
    return post<void>('/api/friendship/reject-request', { userId })
  }

  // Remove friend
  const removeFriend = async (friendshipId: string): Promise<void> => {
    return del<void>(`/api/friends/${friendshipId}`)
  }

  // Block user
  const blockUser = async (userId: string): Promise<void> => {
    return post<void>(`/api/users/${userId}/block`)
  }

  // Unblock user
  const unblockUser = async (userId: string): Promise<void> => {
    return post<void>(`/api/users/${userId}/unblock`)
  }

  // Get blocked users
  const getBlockedUsers = async (): Promise<IUser[]> => {
    return get<IUser[]>('/api/users/blocked')
  }

  // === FILE UPLOAD APIs ===

  // Upload file
  const uploadFile = async (file: File, type: 'image' | 'file' | 'video' | 'audio' = 'file'): Promise<{
    url: string
    filename: string
    size: number
    mimeType: string
  }> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    isLoading.value = true
    error.value = null

    try {
      const token = getAuthToken()
      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Upload failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (err: any) {
      error.value = err
      console.error('File upload error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Upload multiple files
  const uploadFiles = async (files: File[]): Promise<Array<{
    url: string
    filename: string
    size: number
    mimeType: string
  }>> => {
    return Promise.all(files.map(file => uploadFile(file)))
  }

  // === AUTH APIs ===

  // Social login (Google, Facebook, etc.)
  const socialLogin = async (provider: 'google' | 'facebook', accessToken: string): Promise<{
    user: IUser
    accessToken: string
  }> => {
    return post<{ user: IUser; accessToken: string }>('/api/auth/social-login', {
      type: provider,
      accessToken,
    })
  }

  // Refresh auth token
  const refreshToken = async (): Promise<{ token: string }> => {
    return post<{ token: string }>('/api/auth/refresh')
  }

  // Logout
  const logout = async (): Promise<void> => {
    await post<void>('/api/auth/logout')
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  // === UTILITY METHODS ===

  // Show error message
  const showError = (message: string) => {
    ElMessage.error({
      message,
      duration: 3000,
    })
  }

  // Show success message
  const showSuccess = (message: string) => {
    ElMessage.success({
      message,
      duration: 3000,
    })
  }

  return {
    // State
    isLoading,
    error,

    // HTTP methods
    get,
    post,
    put,
    patch,
    del,

    // Auth utilities
    getAuthToken,
    hasValidToken,

    // User APIs
    getCurrentUser,
    getUserById,
    updateUserProfile,
    searchUsers,
    searchUsersForFriendship,
    getOnlineUsers,

    // Conversation APIs
    getConversations,
    getConversationById,
    createConversation,
    updateConversation,
    deleteConversation,
    addParticipant,
    removeParticipant,

    // Message APIs
    getMessages,
    getMessageById,
    sendMessage,
    updateMessage,
    deleteMessage,
    markMessageAsRead,
    markMessagesAsDelivered,

    // Friendship APIs
    getFriendshipList,
    getFriends,
    getFriendRequests,
    sendFriendRequest,
    sendFriendshipRequest,
    acceptFriendRequest,
    acceptFriendshipRequest,
    rejectFriendRequest,
    rejectFriendshipRequest,
    removeFriend,
    blockUser,
    unblockUser,
    getBlockedUsers,

    // File Upload APIs
    uploadFile,
    uploadFiles,

    // Auth APIs
    socialLogin,
    refreshToken,
    logout,

    // Utilities
    showError,
    showSuccess,
  }
}
