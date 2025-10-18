<template>
  <div class="search-friends">
    <!-- Search Header -->
    <div class="search-header">
      <el-input
        v-model="searchQuery"
        placeholder="Search users by name or email..."
        :prefix-icon="Search"
        size="large"
        clearable
        @input="handleSearchInput"
        @clear="handleClear"
      >
        <template #suffix>
          <el-icon v-if="isSearching" class="is-loading">
            <Loading />
          </el-icon>
        </template>
      </el-input>

      <div class="search-options">
        <el-checkbox v-model="excludeFriends" @change="handleSearch">
          Exclude friends
        </el-checkbox>
      </div>
    </div>

    <!-- Results -->
    <div class="search-results">
      <!-- Loading State -->
      <div v-if="isSearching && users.length === 0" class="empty-state">
        <el-icon :size="48" class="rotating">
          <Loading />
        </el-icon>
        <p>Searching users...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!isSearching && users.length === 0 && searchQuery" class="empty-state">
        <el-icon :size="48">
          <UserFilled />
        </el-icon>
        <p>No users found</p>
        <span class="empty-hint">Try a different search term</span>
      </div>

      <!-- Initial State -->
      <div v-else-if="!searchQuery" class="empty-state">
        <el-icon :size="48">
          <Search />
        </el-icon>
        <p>Search for friends</p>
        <span class="empty-hint">Enter a name or email to find users</span>
      </div>

      <!-- User List -->
      <div v-else class="user-list">
        <div
          v-for="user in users"
          :key="user.id"
          class="user-card"
        >
          <div class="user-info">
            <div class="user-avatar-wrapper">
              <el-avatar :size="48" :src="user.avatar">
                {{ user.name.charAt(0).toUpperCase() }}
              </el-avatar>
              <div v-if="user.isOnline" class="online-badge"></div>
            </div>

            <div class="user-details">
              <div class="user-name-row">
                <span class="user-name">{{ user.name }}</span>
                <el-tag
                  v-if="user.isPrivate"
                  size="small"
                  type="info"
                  effect="plain"
                >
                  <el-icon :size="12"><Lock /></el-icon>
                  Private
                </el-tag>
              </div>
              <span class="user-email">{{ user.email }}</span>
              <span v-if="!user.isOnline && user.lastSeen" class="user-status">
                Last seen {{ formatLastSeen(user.lastSeen) }}
              </span>
              <span v-else-if="user.isOnline" class="user-status online">
                Online now
              </span>
            </div>
          </div>

          <div class="user-actions">
            <!-- Friend Request Sent -->
            <el-button
              v-if="user.friendshipStatus === 'pending'"
              type="info"
              size="default"
              disabled
            >
              <el-icon><Clock /></el-icon>
              Request Sent
            </el-button>

            <!-- Already Friends -->
            <el-button
              v-else-if="user.friendshipStatus === 'accepted'"
              type="success"
              size="default"
              disabled
            >
              <el-icon><Check /></el-icon>
              Friends
            </el-button>

            <!-- Request Received -->
            <div v-else-if="user.friendshipStatus === 'received'" class="action-group">
              <el-button
                type="success"
                size="default"
                @click="handleAcceptRequest(user)"
                :loading="loadingUserId === user.id && loadingAction === 'accept'"
              >
                <el-icon><Check /></el-icon>
                Accept
              </el-button>
              <el-button
                type="danger"
                size="default"
                plain
                @click="handleRejectRequest(user)"
                :loading="loadingUserId === user.id && loadingAction === 'reject'"
              >
                <el-icon><Close /></el-icon>
                Reject
              </el-button>
            </div>

            <!-- Can't Send Request (Private/Disabled) -->
            <el-tooltip
              v-else-if="!user.allowFriendRequests"
              content="This user doesn't accept friend requests"
              placement="top"
            >
              <el-button
                type="default"
                size="default"
                disabled
              >
                <el-icon><Lock /></el-icon>
                Can't Add
              </el-button>
            </el-tooltip>

            <!-- Send Friend Request -->
            <el-button
              v-else
              type="primary"
              size="default"
              @click="handleSendRequest(user)"
              :loading="loadingUserId === user.id && loadingAction === 'send'"
            >
              <el-icon><UserFilled /></el-icon>
              Add Friend
            </el-button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="users.length > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 30, 50]"
          :total="totalUsers"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Search,
  Loading,
  UserFilled,
  Clock,
  Check,
  Close,
  Lock
} from '@element-plus/icons-vue'

interface SearchUser {
  id: string
  name: string
  email: string
  avatar: string
  isOnline: boolean
  lastSeen?: string
  isPrivate: boolean
  allowFriendRequests: boolean
  friendshipStatus?: 'pending' | 'accepted' | 'received' | 'blocked'
}

interface SearchResponse {
  users: SearchUser[]
  totalUsers: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// Props & Emits
const emit = defineEmits<{
  sendRequest: [userId: string]
  acceptRequest: [userId: string]
  rejectRequest: [userId: string]
}>()

// State
const searchQuery = ref('')
const excludeFriends = ref(true)
const isSearching = ref(false)
const users = ref<SearchUser[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalUsers = ref(0)
const totalPages = ref(0)
const hasNextPage = ref(false)
const hasPrevPage = ref(false)

// Loading state for individual user actions
const loadingUserId = ref<string | null>(null)
const loadingAction = ref<'send' | 'accept' | 'reject' | null>(null)

// Debounce timer
let searchTimeout: number | null = null

// API Base URL
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

// Format last seen time
const formatLastSeen = (lastSeen: string) => {
  const date = new Date(lastSeen)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Search API call
const searchUsers = async () => {
  if (!searchQuery.value.trim()) {
    users.value = []
    return
  }

  isSearching.value = true

  try {
    const params = new URLSearchParams({
      query: searchQuery.value.trim(),
      page: currentPage.value.toString(),
      limit: pageSize.value.toString(),
      excludeCurrentUser: 'true',
      excludeFriends: excludeFriends.value.toString()
    })

    const url = `${apiBaseUrl}/api/friendship/search-users?${params}`

    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token')

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    })

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }

    const data: SearchResponse = await response.json()

    users.value = data.users
    totalUsers.value = data.totalUsers
    totalPages.value = data.totalPages
    hasNextPage.value = data.hasNextPage
    hasPrevPage.value = data.hasPrevPage

    console.log('✅ Search results:', data)
  } catch (error: any) {
    console.error('Search error:', error)
    ElMessage.error({
      message: error.message || 'Failed to search users',
      duration: 3000
    })
    users.value = []
  } finally {
    isSearching.value = false
  }
}

// Handle search input with debounce
const handleSearchInput = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = window.setTimeout(() => {
    currentPage.value = 1 // Reset to first page
    handleSearch()
  }, 500) // 500ms debounce
}

// Handle search
const handleSearch = () => {
  searchUsers()
}

// Handle clear
const handleClear = () => {
  searchQuery.value = ''
  users.value = []
  currentPage.value = 1
}

// Handle page change
const handlePageChange = (page: number) => {
  currentPage.value = page
  searchUsers()
}

// Handle page size change
const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
  searchUsers()
}

// Handle send friend request
const handleSendRequest = async (user: SearchUser) => {
  loadingUserId.value = user.id
  loadingAction.value = 'send'

  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${apiBaseUrl}/api/friendship/send-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({ userId: user.id })
    })

    if (!response.ok) {
      throw new Error('Failed to send friend request')
    }

    ElMessage.success({
      message: `Friend request sent to ${user.name}`,
      duration: 3000
    })

    // Update user status
    user.friendshipStatus = 'pending'
    emit('sendRequest', user.id)
  } catch (error: any) {
    console.error('Send request error:', error)
    ElMessage.error({
      message: error.message || 'Failed to send friend request',
      duration: 3000
    })
  } finally {
    loadingUserId.value = null
    loadingAction.value = null
  }
}

// Handle accept friend request
const handleAcceptRequest = async (user: SearchUser) => {
  loadingUserId.value = user.id
  loadingAction.value = 'accept'

  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${apiBaseUrl}/api/friendship/accept-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({ userId: user.id })
    })

    if (!response.ok) {
      throw new Error('Failed to accept friend request')
    }

    ElMessage.success({
      message: `You are now friends with ${user.name}`,
      duration: 3000
    })

    // Update user status
    user.friendshipStatus = 'accepted'
    emit('acceptRequest', user.id)
  } catch (error: any) {
    console.error('Accept request error:', error)
    ElMessage.error({
      message: error.message || 'Failed to accept friend request',
      duration: 3000
    })
  } finally {
    loadingUserId.value = null
    loadingAction.value = null
  }
}

// Handle reject friend request
const handleRejectRequest = async (user: SearchUser) => {
  loadingUserId.value = user.id
  loadingAction.value = 'reject'

  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${apiBaseUrl}/api/friendship/reject-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({ userId: user.id })
    })

    if (!response.ok) {
      throw new Error('Failed to reject friend request')
    }

    ElMessage.info({
      message: `Friend request from ${user.name} rejected`,
      duration: 3000
    })

    // Remove from list or update status
    users.value = users.value.filter(u => u.id !== user.id)
    emit('rejectRequest', user.id)
  } catch (error: any) {
    console.error('Reject request error:', error)
    ElMessage.error({
      message: error.message || 'Failed to reject friend request',
      duration: 3000
    })
  } finally {
    loadingUserId.value = null
    loadingAction.value = null
  }
}
</script>

<style scoped>
.search-friends {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.search-header {
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.search-options {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;
  text-align: center;
}

.empty-state .el-icon {
  margin-bottom: 16px;
  color: #d1d5db;
}

.empty-state p {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #6b7280;
}

.empty-hint {
  font-size: 14px;
  color: #9ca3af;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.user-card:hover {
  border-color: #10a37f;
  box-shadow: 0 4px 12px rgba(16, 163, 127, 0.1);
  transform: translateY(-2px);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.user-avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.online-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  background: #10b981;
  border: 2px solid #fff;
  border-radius: 50%;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-email {
  font-size: 14px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-status {
  font-size: 12px;
  color: #9ca3af;
}

.user-status.online {
  color: #10b981;
  font-weight: 500;
}

.user-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.action-group {
  display: flex;
  gap: 8px;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.rotating {
  animation: rotate 1s linear infinite;
}

/* Responsive */
@media (max-width: 768px) {
  .search-header {
    padding: 16px;
  }

  .search-results {
    padding: 16px;
  }

  .user-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .user-info {
    width: 100%;
  }

  .user-actions {
    width: 100%;
    margin-left: 0;
  }

  .user-actions .el-button {
    width: 100%;
  }

  .action-group {
    width: 100%;
    flex-direction: column;
  }

  .action-group .el-button {
    width: 100%;
  }

  .pagination-wrapper :deep(.el-pagination) {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
