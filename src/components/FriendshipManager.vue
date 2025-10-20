<template>
  <div class="friendship-manager">
    <el-tabs v-model="activeTab" class="friendship-tabs">
      <!-- Friends Tab -->
      <el-tab-pane name="friends">
        <template #label>
          <span class="tab-label">
            <el-icon><User /></el-icon>
            Friends
            <el-badge v-if="totalFriends" :value="totalFriends" class="tab-badge" />
          </span>
        </template>

        <div class="tab-content">
          <div v-if="isLoading && friendsList.length === 0" class="loading-state">
            <el-icon class="is-loading"><Loading /></el-icon>
            <p>Loading friends...</p>
          </div>

          <div v-else-if="friendsList.length === 0" class="empty-state">
            <el-icon :size="48"><UserFilled /></el-icon>
            <p>No friends yet</p>
            <el-button type="primary" @click="activeTab = 'search'">
              Find Friends
            </el-button>
          </div>

          <div v-else class="friends-list">
            <div
              v-for="friend in friendsList"
              :key="friend.id"
              class="friend-card"
            >
              <div class="friend-info">
                <div class="friend-avatar-wrapper">
                  <el-avatar :size="48" :src="friend.avatarUrl || friend.avatar">
                    {{ friend.name.charAt(0).toUpperCase() }}
                  </el-avatar>
                  <div v-if="friend.isOnline" class="online-badge"></div>
                </div>

                <div class="friend-details">
                  <div class="friend-name">{{ friend.name }}</div>
                  <div class="friend-email">{{ friend.email }}</div>
                  <div v-if="!friend.isOnline && friend.lastSeen" class="friend-status">
                    Last seen {{ formatLastSeen(friend.lastSeen) }}
                  </div>
                </div>
              </div>

              <div class="friend-actions">
                <el-dropdown trigger="click">
                  <el-button circle>
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="startChat(friend)">
                        <el-icon><ChatDotRound /></el-icon>
                        Send Message
                      </el-dropdown-item>
                      <el-dropdown-item divided @click="confirmRemoveFriend(friend)">
                        <el-icon><UserFilled /></el-icon>
                        Remove Friend
                      </el-dropdown-item>
                      <el-dropdown-item @click="confirmBlockUser(friend)">
                        <el-icon><CircleClose /></el-icon>
                        Block User
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Pending Requests Tab -->
      <el-tab-pane name="requests">
        <template #label>
          <span class="tab-label">
            <el-icon><Bell /></el-icon>
            Requests
            <el-badge
              v-if="totalPendingRequests"
              :value="totalPendingRequests"
              type="danger"
              class="tab-badge"
            />
          </span>
        </template>

        <div class="tab-content">
          <div v-if="pendingRequests.length === 0" class="empty-state">
            <el-icon :size="48"><Bell /></el-icon>
            <p>No pending requests</p>
          </div>

          <div v-else class="requests-list">
            <div
              v-for="request in pendingRequests"
              :key="request._id"
              class="request-card"
            >
              <div class="request-info">
                <el-avatar :size="48">
                  {{ getRequestUserName(request).charAt(0).toUpperCase() }}
                </el-avatar>

                <div class="request-details">
                  <div class="request-name">{{ getRequestUserName(request) }}</div>
                  <div v-if="request.message" class="request-message">
                    "{{ request.message }}"
                  </div>
                  <div class="request-time">
                    {{ formatTime(request.createdAt) }}
                  </div>
                </div>
              </div>

              <div class="request-actions">
                <el-button
                  type="success"
                  size="default"
                  @click="acceptRequest(request)"
                  :loading="actionLoading === request._id"
                >
                  <el-icon><Check /></el-icon>
                  Accept
                </el-button>
                <el-button
                  type="danger"
                  size="default"
                  plain
                  @click="declineRequest(request)"
                  :loading="actionLoading === request._id"
                >
                  <el-icon><Close /></el-icon>
                  Decline
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Sent Requests Tab -->
      <el-tab-pane name="sent">
        <template #label>
          <span class="tab-label">
            <el-icon><Clock /></el-icon>
            Sent
            <el-badge v-if="totalSentRequests" :value="totalSentRequests" class="tab-badge" />
          </span>
        </template>

        <div class="tab-content">
          <div v-if="sentRequests.length === 0" class="empty-state">
            <el-icon :size="48"><Clock /></el-icon>
            <p>No sent requests</p>
          </div>

          <div v-else class="requests-list">
            <div
              v-for="request in sentRequests"
              :key="request._id"
              class="request-card"
            >
              <div class="request-info">
                <el-avatar :size="48">
                  {{ getRequestUserName(request).charAt(0).toUpperCase() }}
                </el-avatar>

                <div class="request-details">
                  <div class="request-name">{{ getRequestUserName(request) }}</div>
                  <div class="request-status">
                    <el-tag type="warning" size="small">Pending</el-tag>
                  </div>
                  <div class="request-time">
                    Sent {{ formatTime(request.createdAt) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Blocked Users Tab -->
      <el-tab-pane name="blocked">
        <template #label>
          <span class="tab-label">
            <el-icon><CircleClose /></el-icon>
            Blocked
            <el-badge v-if="totalBlockedUsers" :value="totalBlockedUsers" class="tab-badge" />
          </span>
        </template>

        <div class="tab-content">
          <div v-if="blockedUsers.length === 0" class="empty-state">
            <el-icon :size="48"><CircleClose /></el-icon>
            <p>No blocked users</p>
          </div>

          <div v-else class="blocked-list">
            <div
              v-for="user in blockedUsers"
              :key="user.id"
              class="blocked-card"
            >
              <div class="blocked-info">
                <el-avatar :size="48" :src="user.avatarUrl || user.avatar">
                  {{ user.name.charAt(0).toUpperCase() }}
                </el-avatar>

                <div class="blocked-details">
                  <div class="blocked-name">{{ user.name }}</div>
                  <div class="blocked-email">{{ user.email }}</div>
                </div>
              </div>

              <el-button
                type="primary"
                size="default"
                @click="confirmUnblockUser(user)"
                :loading="actionLoading === user.id"
              >
                <el-icon><Unlock /></el-icon>
                Unblock
              </el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Search Tab (reuse SearchFriends) -->
      <el-tab-pane name="search">
        <template #label>
          <span class="tab-label">
            <el-icon><Search /></el-icon>
            Find Friends
          </span>
        </template>

        <SearchFriends @send-request="handleRequestSent" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import {
  User,
  UserFilled,
  Loading,
  MoreFilled,
  ChatDotRound,
  CircleClose,
  Bell,
  Check,
  Close,
  Clock,
  Unlock,
  Search
} from '@element-plus/icons-vue'
import { useFriendship } from '../composables/useFriendship'
import SearchFriends from './SearchFriends.vue'
import type { IFriendUser, IFriendship } from '../interfaces/friendship.interface'

// Emits
const emit = defineEmits<{
  startChat: [user: IFriendUser]
  refresh: []
}>()

// Friendship composable
const {
  friendsList,
  pendingRequests,
  sentRequests,
  blockedUsers,
  isLoading,
  totalFriends,
  totalPendingRequests,
  totalSentRequests,
  totalBlockedUsers,
  getFriendshipList,
  respondToRequest,
  removeFriend,
  blockUser,
  unblockUser
} = useFriendship()

// State
const activeTab = ref('friends')
const actionLoading = ref<string | null>(null)

// Load data on mount
onMounted(() => {
  getFriendshipList()
})

// Format time
const formatTime = (date: Date | string) => {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

const formatLastSeen = (date: Date | string) => {
  return formatTime(date)
}

// Get request user name (would need user data from API)
const getRequestUserName = (request: IFriendship) => {
  // TODO: Fetch user data or include in request
  return 'User ' + request?.requesterId?.substring(0, 8)
}

// Accept request
const acceptRequest = async (request: IFriendship) => {
  actionLoading.value = request._id
  try {
    await respondToRequest(request._id, 'accepted')
    emit('refresh')
  } finally {
    actionLoading.value = null
  }
}

// Decline request
const declineRequest = async (request: IFriendship) => {
  actionLoading.value = request._id
  try {
    await respondToRequest(request._id, 'declined')
  } finally {
    actionLoading.value = null
  }
}

// Confirm remove friend
const confirmRemoveFriend = (friend: IFriendUser) => {
  ElMessageBox.confirm(
    `Are you sure you want to remove ${friend.name} from your friends?`,
    'Remove Friend',
    {
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
      type: 'warning'
    }
  ).then(async () => {
    await removeFriend(friend.id)
    emit('refresh')
  }).catch(() => {
    // Cancelled
  })
}

// Confirm block user
const confirmBlockUser = (user: IFriendUser) => {
  ElMessageBox.confirm(
    `Are you sure you want to block ${user.name}? They won't be able to send you messages.`,
    'Block User',
    {
      confirmButtonText: 'Block',
      cancelButtonText: 'Cancel',
      type: 'warning'
    }
  ).then(async () => {
    await blockUser(user.id)
    emit('refresh')
  }).catch(() => {
    // Cancelled
  })
}

// Confirm unblock user
const confirmUnblockUser = (user: IFriendUser) => {
  ElMessageBox.confirm(
    `Unblock ${user.name}?`,
    'Unblock User',
    {
      confirmButtonText: 'Unblock',
      cancelButtonText: 'Cancel',
      type: 'info'
    }
  ).then(async () => {
    actionLoading.value = user.id
    try {
      await unblockUser(user.id)
      emit('refresh')
    } finally {
      actionLoading.value = null
    }
  }).catch(() => {
    // Cancelled
  })
}

// Start chat
const startChat = (friend: IFriendUser) => {
  emit('startChat', friend)
}

// Handle request sent
const handleRequestSent = () => {
  getFriendshipList()
  activeTab.value = 'sent'
}
</script>

<style scoped>
.friendship-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.friendship-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.friendship-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
}

.friendship-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-badge {
  margin-left: 4px;
}

.tab-content {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;
  text-align: center;
}

.loading-state .el-icon,
.empty-state .el-icon {
  margin-bottom: 16px;
  color: #d1d5db;
}

.empty-state p {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #6b7280;
}

/* Friends List */
.friends-list,
.requests-list,
.blocked-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.friend-card,
.request-card,
.blocked-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.friend-card:hover,
.request-card:hover,
.blocked-card:hover {
  border-color: #10a37f;
  box-shadow: 0 4px 12px rgba(16, 163, 127, 0.1);
}

.friend-info,
.request-info,
.blocked-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.friend-avatar-wrapper {
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

.friend-details,
.request-details,
.blocked-details {
  flex: 1;
  min-width: 0;
}

.friend-name,
.request-name,
.blocked-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-email,
.blocked-email {
  font-size: 14px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-status,
.request-time {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.request-message {
  font-size: 13px;
  color: #4b5563;
  font-style: italic;
  margin: 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-status {
  margin: 4px 0;
}

.friend-actions,
.request-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

/* Responsive */
@media (max-width: 768px) {
  .friend-card,
  .request-card,
  .blocked-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .friend-actions,
  .request-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
