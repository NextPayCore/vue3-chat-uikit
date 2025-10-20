<template>
  <div class="blocked-users-list">
    <!-- Header -->
    <div class="blocked-header">
      <h3>Blocked Users</h3>
      <el-badge :value="blockedCount" :hidden="blockedCount === 0" type="danger">
        <el-icon :size="20"><UserFilled /></el-icon>
      </el-badge>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading-container">
      <el-skeleton :rows="3" animated />
    </div>

    <!-- Empty state -->
    <div v-else-if="blockedUsers.length === 0" class="empty-state">
      <el-empty description="No blocked users">
        <template #image>
          <el-icon :size="60" color="#909399">
            <CircleCheckFilled />
          </el-icon>
        </template>
        <template #description>
          <p>You haven't blocked anyone yet</p>
        </template>
      </el-empty>
    </div>

    <!-- Blocked users list -->
    <div v-else class="blocked-list">
      <div
        v-for="blockedUser in blockedUsersWithInfo"
        :key="blockedUser.id"
        class="blocked-item"
      >
        <div class="blocked-user-info">
          <el-avatar :src="blockedUser.avatarUrl" :size="40">
            {{ blockedUser.name?.charAt(0) }}
          </el-avatar>
          
          <div class="user-details">
            <div class="user-name">{{ blockedUser.name }}</div>
            <div class="user-email">{{ blockedUser.email }}</div>
            <div class="blocked-date">
              Blocked {{ formatDate(blockedUser.blockedAt) }}
            </div>
          </div>
        </div>

        <div class="blocked-actions">
          <el-popconfirm
            title="Are you sure you want to unblock this user?"
            confirm-button-text="Unblock"
            cancel-button-text="Cancel"
            @confirm="handleUnblock(blockedUser.userId)"
          >
            <template #reference>
              <el-button type="danger" size="small" :loading="isLoading">
                <el-icon><CircleClose /></el-icon>
                Unblock
              </el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>

    <!-- Info message -->
    <el-alert
      v-if="blockedUsers.length > 0"
      type="info"
      :closable="false"
      show-icon
      class="info-alert"
    >
      <template #title>
        <strong>What happens when you block someone?</strong>
      </template>
      <ul>
        <li>They cannot find you in search results</li>
        <li>They cannot send you friend requests</li>
        <li>You cannot send them friend requests</li>
        <li>Any existing friendship will be removed</li>
        <li>They cannot message you</li>
      </ul>
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  ElAvatar,
  ElButton,
  ElIcon,
  ElBadge,
  ElEmpty,
  ElSkeleton,
  ElPopconfirm,
  ElAlert
} from 'element-plus'
import {
  UserFilled,
  CircleClose,
  CircleCheckFilled
} from '@element-plus/icons-vue'
import { useBlockedUsers } from '../composables/useBlockedUsers'
import { useAuth } from '../composables/useAuth'
import type { IFriendship } from '../interfaces/friendship.interface'

interface BlockedUserInfo extends IFriendship {
  userId: string
  name: string
  email: string
  avatarUrl: string
}

const emit = defineEmits<{
  unblock: [userId: string]
  refresh: []
}>()

// Composables
const {
  blockedUsers,
  isLoading,
  getBlockedUsers,
  unblockUser
} = useBlockedUsers()

const { currentUser } = useAuth()

// Computed
const blockedCount = computed(() => blockedUsers.value.length)

const blockedUsersWithInfo = computed((): BlockedUserInfo[] => {
  return blockedUsers.value.map(blocked => {
    // Determine who is the blocked user (not the current user)
    const isRequester = blocked.requesterId === currentUser.value?.id
    const blockedUserId = isRequester ? blocked.addresseeId : blocked.requesterId
    
    // Get user info from the friendship object
    // In the real API, this should include populated user data
    return {
      ...blocked,
      userId: blockedUserId,
      name: `User ${blockedUserId.substring(0, 8)}`, // Placeholder
      email: '', // Should come from API
      avatarUrl: '' // Should come from API
    }
  })
})

// Methods
const formatDate = (date?: Date | string): string => {
  if (!date) return 'Unknown'
  
  const d = new Date(date)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - d.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return 'today'
  } else if (diffDays === 1) {
    return 'yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} ${months === 1 ? 'month' : 'months'} ago`
  } else {
    return d.toLocaleDateString()
  }
}

const handleUnblock = async (userId: string) => {
  const success = await unblockUser(userId)
  if (success) {
    emit('unblock', userId)
    emit('refresh')
  }
}

const refresh = async () => {
  await getBlockedUsers()
}

// Lifecycle
onMounted(() => {
  getBlockedUsers()
})

// Expose methods for parent component
defineExpose({
  refresh
})
</script>

<style scoped>
.blocked-users-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.blocked-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 2px solid #e5e7eb;
}

.blocked-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.loading-container {
  padding: 20px 0;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
}

.empty-state p {
  color: #6b7280;
  font-size: 14px;
  margin-top: 12px;
}

.blocked-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.blocked-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s;
}

.blocked-item:hover {
  background: #f3f4f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.blocked-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.user-email {
  font-size: 13px;
  color: #6b7280;
}

.blocked-date {
  font-size: 12px;
  color: #ef4444;
  font-style: italic;
}

.blocked-actions {
  flex-shrink: 0;
}

.info-alert {
  margin-top: 8px;
}

.info-alert ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.info-alert li {
  font-size: 13px;
  color: #6b7280;
  margin: 4px 0;
}

@media (max-width: 768px) {
  .blocked-users-list {
    padding: 16px;
  }

  .blocked-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .blocked-actions {
    width: 100%;
  }

  .blocked-actions .el-button {
    width: 100%;
  }
}
</style>
