<template>
  <div v-if="pinnedMessages.length > 0" class="pinned-messages-container">
    <!-- Header with gradient -->
    <div class="pinned-header" @click="toggleCollapse">
      <div class="header-content">
        <el-icon class="pin-icon" :size="18">
          <component :is="FlagIcon" />
        </el-icon>
        <span class="header-title">Pinned Messages ({{ pinnedMessages.length }}/5)</span>
      </div>
      <el-icon class="collapse-icon" :size="16">
        <component :is="isCollapsed ? ArrowDownIcon : ArrowUpIcon" />
      </el-icon>
    </div>

    <!-- Pinned messages list with drag & drop -->
    <transition name="collapse">
      <div v-show="!isCollapsed" class="pinned-list">
        <draggable
          v-model="localPinnedMessages"
          item-key="message.id"
          handle=".drag-handle"
          animation="200"
          @end="onDragEnd"
          class="draggable-list"
        >
          <template #item="{ element, index }">
            <div
              class="pinned-item"
              :class="{ 'dragging': isDragging }"
              @click="scrollToMessage(element.message.id)"
            >
              <!-- Drag handle -->
              <div class="drag-handle">
                <el-icon :size="14">
                  <component :is="GridIcon" />
                </el-icon>
              </div>

              <!-- Order badge -->
              <div class="order-badge">{{ index + 1 }}</div>

              <!-- Message content -->
              <div class="message-content">
                <div class="sender-name">{{ element.message.sender?.name || 'Unknown' }}</div>
                <div class="message-text">{{ truncateText(element.message.content, 100) }}</div>
                <div class="message-time">
                  Pinned {{ formatTime(element.pinnedAt) }}
                </div>
              </div>

              <!-- Unpin button -->
              <button
                class="unpin-btn"
                @click.stop="handleUnpin(element.message.id)"
                title="Unpin message"
              >
                <el-icon :size="16">
                  <component :is="CloseIcon" />
                </el-icon>
              </button>
            </div>
          </template>
        </draggable>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import { ElIcon } from 'element-plus'
import { Flag as FlagIcon, ArrowDown as ArrowDownIcon, ArrowUp as ArrowUpIcon, Grid as GridIcon, Close as CloseIcon } from '@element-plus/icons-vue'
import type { IPinnedMessage } from '@/interfaces/pin.interface'

interface Props {
  pinnedMessages: IPinnedMessage[]
  conversationId: string
}

interface Emits {
  (e: 'unpin', messageId: string): void
  (e: 'reorder', messageId: string, newOrder: number): void
  (e: 'scroll-to', messageId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// State
const isCollapsed = ref(false)
const isDragging = ref(false)
const localPinnedMessages = ref<IPinnedMessage[]>([...props.pinnedMessages])

// Watch for external updates
watch(
  () => props.pinnedMessages,
  (newMessages) => {
    if (!isDragging.value) {
      localPinnedMessages.value = [...newMessages]
    }
  },
  { deep: true }
)

// Methods
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleUnpin = (messageId: string) => {
  emit('unpin', messageId)
}

const scrollToMessage = (messageId: string) => {
  emit('scroll-to', messageId)
}

const onDragEnd = (event: any) => {
  isDragging.value = false
  const { oldIndex, newIndex } = event

  if (oldIndex !== newIndex && newIndex !== undefined) {
    const movedMessage = localPinnedMessages.value[newIndex]
    if (movedMessage) {
      console.log(`🔄 Reordering message ${movedMessage.message.id} from ${oldIndex} to ${newIndex}`)
      emit('reorder', movedMessage.message.id, newIndex)
    }
  }
}

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const formatTime = (date: Date): string => {
  const now = new Date()
  const pinDate = new Date(date)
  const diffMs = now.getTime() - pinDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return pinDate.toLocaleDateString()
}
</script>

<style scoped>
.pinned-messages-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  margin-bottom: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.pinned-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.pinned-header:hover {
  background: linear-gradient(135deg, #5568d3 0%, #653a8b 100%);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pin-icon {
  color: #ffd700;
  filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.5));
}

.header-title {
  color: white;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.3px;
}

.collapse-icon {
  color: white;
  opacity: 0.9;
  transition: transform 0.3s ease;
}

/* Collapse transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

/* Pinned list */
.pinned-list {
  padding: 8px;
  background: linear-gradient(to bottom, #f8f9ff 0%, #ffffff 100%);
}

.draggable-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Pinned item */
.pinned-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: white;
  border: 1px solid #e8ebf7;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.pinned-item:hover {
  background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.pinned-item.dragging {
  opacity: 0.5;
}

/* Drag handle */
.drag-handle {
  cursor: grab;
  color: #a0a5c0;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.drag-handle:hover {
  background: #f0f2ff;
  color: #667eea;
}

.drag-handle:active {
  cursor: grabbing;
}

/* Order badge */
.order-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

/* Message content */
.message-content {
  flex: 1;
  min-width: 0;
}

.sender-name {
  font-weight: 600;
  font-size: 13px;
  color: #667eea;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-text {
  font-size: 14px;
  color: #4a4a6a;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.message-time {
  font-size: 11px;
  color: #9899ac;
  font-style: italic;
}

/* Unpin button */
.unpin-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #f0f2f5;
  color: #8b8d9c;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.unpin-btn:hover {
  background: #ff4757;
  color: white;
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(255, 71, 87, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .pinned-header {
    padding: 12px 14px;
  }

  .header-title {
    font-size: 14px;
  }

  .pinned-item {
    padding: 10px 12px;
    gap: 8px;
  }

  .message-text {
    font-size: 13px;
  }

  .order-badge {
    width: 20px;
    height: 20px;
    font-size: 11px;
  }
}
</style>
