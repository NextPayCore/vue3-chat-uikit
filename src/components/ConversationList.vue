<template>
  <div class="conversation-list">
    <div class="conversation-list-header">
      <h3>Conversations</h3>
      <el-button
        type="primary"
        size="small"
        :icon="Plus"
        @click="showNewConversationDialog = true"
      >
        New Chat
      </el-button>
    </div>

    <!-- Search bar -->
    <div class="search-bar">
      <el-input
        v-model="searchQuery"
        placeholder="Search conversations..."
        :prefix-icon="Search"
        clearable
      />
    </div>

    <!-- Conversation tabs -->
    <el-tabs v-model="activeTab" class="conversation-tabs">
      <el-tab-pane label="All" name="all">
        <ConversationItems
          :conversations="filteredConversations"
          :active-id="activeConversationId"
          :loading="isLoading"
          @select="handleSelectConversation"
          @delete="handleDeleteConversation"
        />
      </el-tab-pane>
      <el-tab-pane name="private">
        <template #label>
          Private
          <el-badge
            v-if="privateUnreadCount > 0"
            :value="privateUnreadCount"
            :max="99"
            class="tab-badge"
          />
        </template>
        <ConversationItems
          :conversations="filteredPrivateConversations"
          :active-id="activeConversationId"
          :loading="isLoading"
          @select="handleSelectConversation"
          @delete="handleDeleteConversation"
        />
      </el-tab-pane>
      <el-tab-pane name="group">
        <template #label>
          Groups
          <el-badge
            v-if="groupUnreadCount > 0"
            :value="groupUnreadCount"
            :max="99"
            class="tab-badge"
          />
        </template>
        <ConversationItems
          :conversations="filteredGroupConversations"
          :active-id="activeConversationId"
          :loading="isLoading"
          @select="handleSelectConversation"
          @delete="handleDeleteConversation"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- New conversation dialog -->
    <el-dialog
      v-model="showNewConversationDialog"
      title="New Conversation"
      width="500px"
    >
      <el-form :model="newConversationForm" label-position="top">
        <el-form-item label="Type">
          <el-radio-group v-model="newConversationForm.type">
            <el-radio-button label="private">Private Chat</el-radio-button>
            <el-radio-button label="group">Group Chat</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item
          v-if="newConversationForm.type === 'group'"
          label="Group Name"
        >
          <el-input
            v-model="newConversationForm.name"
            placeholder="Enter group name"
          />
        </el-form-item>

        <el-form-item
          v-if="newConversationForm.type === 'group'"
          label="Description (Optional)"
        >
          <el-input
            v-model="newConversationForm.description"
            type="textarea"
            :rows="3"
            placeholder="Enter group description"
          />
        </el-form-item>

        <el-form-item label="Select Friends">
          <el-select
            v-model="newConversationForm.participantIds"
            multiple
            filterable
            placeholder="Select friends to add"
            style="width: 100%"
          >
            <el-option
              v-for="friend in friendsList"
              :key="friend.id"
              :label="friend.name"
              :value="friend.id"
            >
              <div class="friend-option">
                <el-avatar :src="friend.avatarUrl" :size="24">
                  {{ friend.name?.charAt(0) }}
                </el-avatar>
                <span>{{ friend.name }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showNewConversationDialog = false">Cancel</el-button>
        <el-button
          type="primary"
          :loading="isCreating"
          :disabled="!canCreateConversation"
          @click="handleCreateConversation"
        >
          Create
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ElButton,
  ElInput,
  ElTabs,
  ElTabPane,
  ElBadge,
  ElDialog,
  ElForm,
  ElFormItem,
  ElRadioGroup,
  ElRadioButton,
  ElSelect,
  ElOption,
  ElAvatar,
  ElMessage
} from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { useConversation } from '../composables/useConversation'
import { useFriendship } from '../composables/useFriendship'
import type { IConversation } from '../interfaces/conversation.interface'
import ConversationItems from './ConversationItems.vue'

const emit = defineEmits<{
  select: [conversation: IConversation]
}>()

// Composables
const {
  conversations,
  privateConversations,
  groupConversations,
  isLoading,
  getConversations,
  createConversation,
  deleteConversation
} = useConversation()

const { friendsList, getFriendshipList } = useFriendship()

// State
const searchQuery = ref('')
const activeTab = ref('all')
const activeConversationId = ref<string | null>(null)
const showNewConversationDialog = ref(false)
const isCreating = ref(false)

const newConversationForm = ref({
  type: 'private' as 'private' | 'group',
  name: '',
  description: '',
  participantIds: [] as string[]
})

// Computed
const filteredConversations = computed(() => {
  if (!searchQuery.value) return conversations.value

  const query = searchQuery.value.toLowerCase()
  return conversations.value.filter(conv =>
    conv.name?.toLowerCase().includes(query) ||
    conv.participants.some(p => p.name?.toLowerCase().includes(query))
  )
})

const filteredPrivateConversations = computed(() => {
  if (!searchQuery.value) return privateConversations.value

  const query = searchQuery.value.toLowerCase()
  return privateConversations.value.filter(conv =>
    conv.participants.some(p => p.name?.toLowerCase().includes(query))
  )
})

const filteredGroupConversations = computed(() => {
  if (!searchQuery.value) return groupConversations.value

  const query = searchQuery.value.toLowerCase()
  return groupConversations.value.filter(conv =>
    conv.name?.toLowerCase().includes(query)
  )
})

const privateUnreadCount = computed(() =>
  privateConversations.value.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0)
)

const groupUnreadCount = computed(() =>
  groupConversations.value.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0)
)

const canCreateConversation = computed(() => {
  const form = newConversationForm.value
  if (form.participantIds.length === 0) return false
  if (form.type === 'private' && form.participantIds.length !== 1) return false
  if (form.type === 'group' && (form.participantIds.length < 2 || !form.name)) return false
  return true
})

// Methods
const handleSelectConversation = (conversation: IConversation) => {
  activeConversationId.value = conversation._id
  emit('select', conversation)
}

const handleDeleteConversation = async (conversationId: string) => {
  try {
    await deleteConversation(conversationId)
    if (activeConversationId.value === conversationId) {
      activeConversationId.value = null
    }
  } catch (error) {
    console.error('Failed to delete conversation:', error)
  }
}

const handleCreateConversation = async () => {
  isCreating.value = true
  try {
    const form = newConversationForm.value
    const conversation = await createConversation({
      type: form.type,
      participantIds: form.participantIds,
      ...(form.type === 'group' && {
        name: form.name,
        description: form.description
      })
    })

    // Close dialog and reset form
    showNewConversationDialog.value = false
    newConversationForm.value = {
      type: 'private',
      name: '',
      description: '',
      participantIds: []
    }

    // Select the new conversation
    if (conversation) {
      handleSelectConversation(conversation)
    }
  } catch (error) {
    console.error('Failed to create conversation:', error)
  } finally {
    isCreating.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    getConversations(),
    getFriendshipList()
  ])
})
</script>

<style scoped>
.conversation-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-right: 1px solid #e5e7eb;
}

.conversation-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.conversation-list-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.search-bar {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.conversation-tabs {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.conversation-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
}

.tab-badge {
  margin-left: 8px;
}

.friend-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-tabs__nav-wrap) {
  padding: 0 16px;
}
</style>
