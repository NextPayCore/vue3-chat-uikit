<template>
  <div class="conversation-items">
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="5" animated />
    </div>

    <div v-else-if="conversations.length === 0" class="empty-state">
      <el-empty description="No conversations yet">
        <template #image>
          <el-icon :size="80" color="#909399">
            <ChatDotRound />
          </el-icon>
        </template>
      </el-empty>
    </div>

    <div v-else class="conversation-list-content">
      <div
        v-for="conversation in conversations"
        :key="conversation._id"
        class="conversation-item"
        :class="{ active: conversation._id === activeId }"
        @click="handleSelect(conversation)"
      >
        <div class="conversation-avatar">
          <el-badge
            v-if="conversation.unreadCount && conversation.unreadCount > 0"
            :value="conversation.unreadCount"
            :max="99"
            type="danger"
          >
            <el-avatar
              :src="getConversationAvatar(conversation)"
              :size="48"
            >
              {{ getConversationName(conversation).charAt(0) }}
            </el-avatar>
          </el-badge>
          <el-avatar
            v-else
            :src="getConversationAvatar(conversation)"
            :size="48"
          >
            {{ getConversationName(conversation).charAt(0) }}
          </el-avatar>
        </div>

        <div class="conversation-content">
          <div class="conversation-header">
            <span class="conversation-name">
              {{ getConversationName(conversation) }}
            </span>
            <span class="conversation-time">
              {{ formatTime(conversation.lastMessageAt || conversation.updatedAt) }}
            </span>
          </div>

          <div class="conversation-footer">
            <span class="last-message">
              {{ getLastMessagePreview(conversation) }}
            </span>
          </div>
        </div>

        <el-dropdown
          trigger="click"
          @click.stop
          @command="(cmd: string) => handleCommand(cmd, conversation)"
        >
          <el-button :icon="MoreFilled" text circle size="small" />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="delete">
                <el-icon><Delete /></el-icon>
                Delete
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ElAvatar,
  ElBadge,
  ElEmpty,
  ElIcon,
  ElSkeleton,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElButton,
  ElMessageBox
} from 'element-plus'
import { ChatDotRound, MoreFilled, Delete } from '@element-plus/icons-vue'
import type { IConversation } from '../interfaces/conversation.interface'
import { useAuth } from '../composables/useAuth'

interface Props {
  conversations: IConversation[]
  activeId?: string | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  activeId: null,
  loading: false
})

const emit = defineEmits<{
  select: [conversation: IConversation]
  delete: [conversationId: string]
}>()

const { currentUser } = useAuth()

// Methods
const getConversationName = (conversation: IConversation): string => {
  if (conversation.type === 'group') {
    return conversation.name || 'Unnamed Group'
  }

  // For private chat, show the other participant's name
  const otherParticipant = conversation.participants.find(
    p => p.id !== currentUser.value?.id
  )
  return otherParticipant?.name || 'Unknown User'
}

const getConversationAvatar = (conversation: IConversation): string => {
  if (conversation.type === 'group') {
    return conversation.avatar || ''
  }

  // For private chat, show the other participant's avatar
  const otherParticipant = conversation.participants.find(
    p => p.id !== currentUser.value?.id
  )
  return otherParticipant?.avatarUrl || ''
}

const getLastMessagePreview = (conversation: IConversation): string => {
  if (!conversation.lastMessage) {
    return 'No messages yet'
  }

  const msg = conversation.lastMessage
  const isSentByMe = msg.sender?.id === currentUser.value?.id
  const senderPrefix = isSentByMe ? 'You: ' : ''

  if (msg.type === 'image') {
    return `${senderPrefix}📷 Image`
  } else if (msg.type === 'file') {
    return `${senderPrefix}📎 ${msg.metadata?.files?.[0]?.name || 'File'}`
  } else if (msg.type === 'audio') {
    return `${senderPrefix}🎤 Voice message`
  }

  const content = msg.content || ''
  const maxLength = 50
  return `${senderPrefix}${content.length > maxLength ? content.substring(0, maxLength) + '...' : content}`
}

const formatTime = (date: Date | undefined): string => {
  if (!date) return ''

  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now'
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m ago`
  }

  // Today
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  // Yesterday
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  // This week
  if (diff < 604800000) {
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  // Older
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const handleSelect = (conversation: IConversation) => {
  emit('select', conversation)
}

const handleCommand = async (command: string, conversation: IConversation) => {
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(
        'Are you sure you want to delete this conversation?',
        'Confirm Delete',
        {
          confirmButtonText: 'Delete',
          cancelButtonText: 'Cancel',
          type: 'warning'
        }
      )
      emit('delete', conversation._id)
    } catch {
      // User cancelled
    }
  }
}
</script>

<style scoped>
.conversation-items {
  height: 100%;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  padding: 20px;
}

.conversation-list-content {
  display: flex;
  flex-direction: column;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f3f4f6;
}

.conversation-item:hover {
  background-color: #f9fafb;
}

.conversation-item.active {
  background-color: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.conversation-avatar {
  flex-shrink: 0;
}

.conversation-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.conversation-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-time {
  font-size: 12px;
  color: #6b7280;
  flex-shrink: 0;
}

.conversation-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.last-message {
  font-size: 13px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-item .el-dropdown {
  opacity: 0;
  transition: opacity 0.2s;
}

.conversation-item:hover .el-dropdown {
  opacity: 1;
}
</style>
