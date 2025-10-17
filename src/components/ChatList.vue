<template>
  <div class="chat-list-container">
    <!-- Token Quota Display -->
    <div v-if="showTokenQuota && tokenQuota" class="token-quota-section">
      <div class="quota-container">
        <div class="quota-header">
          <span class="quota-label">{{ tokenQuota.label || 'Tokens' }}</span>
          <span class="quota-numbers">{{ tokenQuota.used.toLocaleString() }} / {{ tokenQuota.total.toLocaleString() }}</span>
        </div>
        <div class="quota-progress">
          <el-progress
            :percentage="quotaPercentage"
            :color="quotaColor"
            :stroke-width="8"
            :show-text="false"
            class="quota-bar"
          />
        </div>
        <div class="quota-status">
          <span :class="['status-text', quotaStatusClass]">
            {{ quotaStatusText }}
          </span>
        </div>
      </div>
    </div>

    <div class="chat-messages" ref="messagesContainer">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="[
          'message-wrapper',
          message.role === 'user' ? 'user-message' : 'assistant-message'
        ]"
      >
        <div class="message-content" :class="[
          message.role === 'user' ? 'message-content-right' : ''
        ]"    >
          <!-- Avatar for assistant messages -->
          <div v-if="message.role === 'assistant'" class="message-avatar">
            <div class="avatar-circle">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="gpt-icon">
                <path d="M8.18 1.71a6 6 0 0 0-5.94 6.53 2.5 2.5 0 0 1-.63 2.42L.5 11.5a.5.5 0 0 0 .35.85h14.3a.5.5 0 0 0 .35-.85l-1.11-.84a2.5 2.5 0 0 1-.63-2.42A6 6 0 0 0 8.18 1.71z" fill="white"/>
              </svg>
            </div>
          </div>

          <!-- Message bubble -->
          <div class="message-bubble">
            <!-- Reply to message -->
            <div v-if="message.replyTo" class="reply-message">
              <div class="reply-line"></div>
              <div class="reply-content">
                <div class="reply-header">
                  <span class="reply-author">{{ message.replyTo.role === 'user' ? 'You' : 'Assistant' }}</span>
                  <span class="reply-time">{{ formatTimestamp(message.replyTo.timestamp) }}</span>
                </div>
                <div class="reply-text">
                  <span v-if="message.replyTo.selectedText" class="selected-text">
                    "{{ message.replyTo.selectedText }}"
                  </span>
                  <span v-else>{{ truncateText(message.replyTo.content, 100) }}</span>
                </div>
              </div>
            </div>

            <!-- Voice message -->
            <div v-if="message.metadata?.voice" class="message-voice">
              <div class="voice-message-item">
                <div class="voice-icon">
                  <el-icon><Microphone /></el-icon>
                </div>
                <div class="voice-details">
                  <span class="voice-label">Voice Message</span>
                  <span class="voice-time">{{ message.metadata.voice.duration }}s</span>
                </div>
                <audio :src="message.metadata.voice.url" controls class="voice-audio"></audio>
              </div>
            </div>

            <!-- File attachments -->
            <div v-if="message.metadata?.files" class="message-attachments">
              <div
                v-for="file in message.metadata.files"
                :key="file.id"
                class="attachment-item"
              >
              <div
                v-if="file.type.startsWith('image/') && file.preview"
                class="image-container"
              >
                <img
                  :src="file.preview"
                  :alt="file.name"
                  class="attachment-image"
                />
                <div class="image-overlay">
                  <button
                    @click="copyImage(file.preview)"
                    class="copy-image-btn"
                    title="Copy image"
                  >
                    <el-icon><CopyDocument /></el-icon>
                  </button>
                </div>
              </div>
                <div v-else class="attachment-file">
                  <el-icon class="file-icon"><Document /></el-icon>
                  <span class="file-name">{{ file.name }}</span>
                </div>
              </div>
            </div>

            <div
              v-if="message.content"
              class="message-text"
              v-html="formatMessage(message.content)"
              @mouseup="handleTextSelection($event, message)"
              @touchend="handleTextSelection($event, message)"
              :data-message-id="message.id"
            ></div>

            <!-- Typing indicator -->
            <div v-if="message.isTyping" class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <!-- Message actions -->
            <div v-if="!message.isTyping" class="message-actions">
              <button @click="handleReply(message)" class="reply-btn" title="Reply">
                <el-icon><ChatLineRound /></el-icon>
              </button>
            </div>
          </div>          <!-- Avatar for user messages -->
          <div v-if="message.role === 'user'" class="message-avatar user-avatar">
            <div class="avatar-circle user-avatar-circle">
              <span class="user-initial">{{ getUserInitial() }}</span>
            </div>
          </div>
        </div>

        <!-- Timestamp -->
        <div class="message-timestamp">
          {{ formatTimestamp(message.timestamp) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import { ElIcon, ElMessage, ElProgress } from 'element-plus'
import { Document, Microphone, CopyDocument, ChatLineRound } from '@element-plus/icons-vue'
import type { IMessage } from '../interfaces/message.interface'

interface ChatListProps {
  messages: IMessage[]
  autoScroll?: boolean
  tokenQuota?: {
    used: number
    total: number
    label?: string
  }
  showTokenQuota?: boolean
}

interface ChatListEmits {
  (e: 'reply', message: IMessage, selectedText?: string): void
}

const props = withDefaults(defineProps<ChatListProps>(), {
  autoScroll: true,
  showTokenQuota: false,
  tokenQuota: () => ({ used: 0, total: 1000, label: 'Tokens' })
})

const emit = defineEmits<ChatListEmits>()

const messagesContainer = ref<HTMLElement>()
const selectedText = ref('')
const selectedMessageId = ref('')

// Token quota computed properties
const quotaPercentage = computed(() => {
  if (!props.tokenQuota) return 0
  return Math.min((props.tokenQuota.used / props.tokenQuota.total) * 100, 100)
})

const quotaColor = computed(() => {
  const percentage = quotaPercentage.value
  if (percentage >= 90) return '#f56565' // Red
  if (percentage >= 75) return '#ed8936' // Orange
  if (percentage >= 50) return '#ecc94b' // Yellow
  return '#10a37f' // Green
})

const quotaStatusClass = computed(() => {
  const percentage = quotaPercentage.value
  if (percentage >= 90) return 'status-critical'
  if (percentage >= 75) return 'status-warning'
  if (percentage >= 50) return 'status-moderate'
  return 'status-good'
})

const quotaStatusText = computed(() => {
  const percentage = quotaPercentage.value
  if (percentage >= 100) return 'Quota Exceeded'
  if (percentage >= 90) return 'Quota Almost Full'
  if (percentage >= 75) return 'High Usage'
  if (percentage >= 50) return 'Moderate Usage'
  return 'Good'
})

const scrollToBottom = async () => {
  if (!props.autoScroll || !messagesContainer.value) return

  await nextTick()
  messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
}

// Watch for new messages and auto-scroll
watch(() => props.messages.length, scrollToBottom, { flush: 'post' })

const formatMessage = (content: string) => {
  // Basic markdown-like formatting
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

const formatTimestamp = (timestamp: Date) => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return timestamp.toLocaleDateString()
}

const getUserInitial = () => {
  return 'U' // You can customize this based on user data
}

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const handleTextSelection = (event: Event, message: IMessage) => {
  const selection = window.getSelection()
  if (selection && selection.toString().trim()) {
    const text = selection.toString().trim()
    selectedText.value = text
    selectedMessageId.value = message.id

    // Show context menu or reply button for selected text
    showSelectionMenu(event, message, text)
  } else {
    selectedText.value = ''
    selectedMessageId.value = ''
    hideSelectionMenu()
  }
}

const showSelectionMenu = (event: Event, message: IMessage, text: string) => {
  // For now, we'll automatically trigger reply with selected text
  // In a more advanced implementation, you could show a context menu
  setTimeout(() => {
    handleReplyWithSelection(message, text)
  }, 100)
}

const hideSelectionMenu = () => {
  // Hide any selection menu if implemented
}

const handleReply = (message: IMessage) => {
  emit('reply', message)
}

const handleReplyWithSelection = (message: IMessage, text: string) => {
  emit('reply', message, text)
}

const copyImage = async (imageUrl: string) => {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      // Modern clipboard API approach
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const item = new ClipboardItem({ [blob.type]: blob })
      await navigator.clipboard.write([item])
      ElMessage.success('Image copied to clipboard!')
    } else {
      // Fallback: copy image URL
      await navigator.clipboard.writeText(imageUrl)
      ElMessage.success('Image URL copied to clipboard!')
    }
  } catch (error) {
    console.error('Failed to copy image:', error)
    ElMessage.error('Failed to copy image')
  }
}

defineExpose({
  scrollToBottom
})
</script>

<style scoped>
.chat-list-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #f7f7f8;
  overflow: hidden;
}

.token-quota-section {
  flex-shrink: 0;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 16px 24px;
  backdrop-filter: blur(10px);
}

.quota-container {
  max-width: 768px;
  margin: 0 auto;
  width: 100%;
}

.quota-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.quota-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.quota-numbers {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.quota-progress {
  margin-bottom: 8px;
}

.quota-bar :deep(.el-progress-bar__outer) {
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.quota-bar :deep(.el-progress-bar__inner) {
  border-radius: 4px;
  transition: all 0.3s ease;
}

.quota-status {
  display: flex;
  justify-content: flex-end;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.status-good {
  color: #065f46;
  background: rgba(16, 163, 127, 0.1);
}

.status-moderate {
  color: #92400e;
  background: rgba(236, 201, 75, 0.2);
}

.status-warning {
  color: #c2410c;
  background: rgba(237, 137, 54, 0.2);
}

.status-critical {
  color: #dc2626;
  background: rgba(245, 101, 101, 0.2);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 768px;
  margin: 0 auto;
  width: 100%;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-content {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.user-message {
  align-items: flex-end;
}

.user-message .message-content {
  flex-direction: row-reverse;
}

.user-message .message-content-right {
    flex-direction: row;

}

.avatar-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #10a37f;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar-circle {
  background: #6366f1;
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.gpt-icon {
  width: 16px;
  height: 16px;
}

.message-bubble {
  max-width: 70%;
  padding: 16px;
  border-radius: 18px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
}

.user-message .message-bubble {
  background: #10a37f;
  color: white;
}

.message-text {
  font-size: 15px;
  line-height: 1.5;
  word-wrap: break-word;
  user-select: text;
  cursor: text;
}

.message-text :deep(strong) {
  font-weight: 600;
}

.message-text :deep(em) {
  font-style: italic;
}

.message-text :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

.user-message .message-text :deep(code) {
  background: rgba(255, 255, 255, 0.2);
}

.reply-message {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  border-left: 3px solid #10a37f;
}

.user-message .reply-message {
  background: rgba(255, 255, 255, 0.15);
  border-left-color: rgba(255, 255, 255, 0.5);
}

.reply-line {
  width: 2px;
  background: #10a37f;
  border-radius: 1px;
  margin-right: 4px;
}

.user-message .reply-line {
  background: rgba(255, 255, 255, 0.5);
}

.reply-content {
  flex: 1;
  min-width: 0;
}

.reply-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.reply-author {
  font-size: 12px;
  font-weight: 600;
  color: #10a37f;
}

.user-message .reply-author {
  color: rgba(255, 255, 255, 0.9);
}

.reply-time {
  font-size: 11px;
  color: #6b7280;
}

.user-message .reply-time {
  color: rgba(255, 255, 255, 0.7);
}

.reply-text {
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
  word-break: break-word;
}

.user-message .reply-text {
  color: rgba(255, 255, 255, 0.8);
}

.selected-text {
  font-style: italic;
  background: rgba(16, 163, 127, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  border-left: 2px solid #10a37f;
  display: inline-block;
  margin: 2px 0;
}

.user-message .selected-text {
  background: rgba(255, 255, 255, 0.2);
  border-left-color: rgba(255, 255, 255, 0.6);
}

.message-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-bubble:hover .message-actions {
  opacity: 1;
}

.reply-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.reply-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #374151;
  transform: scale(1.05);
}

.user-message .reply-btn {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.user-message .reply-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  color: white;
}

.message-voice {
  margin-bottom: 12px;
}

.voice-message-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(16, 163, 127, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(16, 163, 127, 0.2);
}

.user-message .voice-message-item {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.voice-icon {
  color: #10a37f;
  font-size: 20px;
  padding: 6px;
  background: rgba(16, 163, 127, 0.2);
  border-radius: 50%;
}

.user-message .voice-icon {
  color: white;
  background: rgba(255, 255, 255, 0.3);
}

.voice-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.voice-label {
  font-size: 13px;
  font-weight: 600;
  color: #2d3748;
}

.user-message .voice-label {
  color: white;
}

.voice-time {
  font-size: 11px;
  color: #718096;
  font-weight: 500;
}

.user-message .voice-time {
  color: rgba(255, 255, 255, 0.8);
}

.voice-audio {
  height: 32px;
  border-radius: 16px;
  max-width: 200px;
}

.message-attachments {
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-item {
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
  position: relative;
}

.image-container {
  position: relative;
  display: inline-block;
}

.image-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-container:hover .image-overlay {
  opacity: 1;
}

.copy-image-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.copy-image-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.05);
}

.copy-image-btn:active {
  transform: scale(0.95);
}

.attachment-image {
  max-width: 200px;
  max-height: 200px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.attachment-image:hover {
  transform: scale(1.02);
}

.attachment-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  color: #374151;
}

.user-message .attachment-file {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.file-icon {
  font-size: 16px;
  color: #6b7280;
}

.user-message .file-icon {
  color: rgba(255, 255, 255, 0.8);
}

.file-name {
  font-size: 13px;
  font-weight: 500;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 8px 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9ca3af;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.message-timestamp {
  font-size: 12px;
  color: #6b7280;
  text-align: center;
  margin-top: 4px;
}

.user-message .message-timestamp {
  text-align: right;
  padding-right: 44px;
}

.assistant-message .message-timestamp {
  text-align: left;
  padding-left: 44px;
}

/* Scrollbar styling */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

@media (max-width: 768px) {
  .token-quota-section {
    padding: 12px 16px;
  }

  .quota-header {
    margin-bottom: 6px;
  }

  .quota-label {
    font-size: 13px;
  }

  .quota-numbers {
    font-size: 12px;
  }

  .status-text {
    font-size: 11px;
    padding: 1px 6px;
  }

  .chat-messages {
    padding: 16px 12px;
    gap: 20px;
  }

  .message-bubble {
    max-width: 85%;
    padding: 12px 16px;
  }

  .message-content {
    gap: 8px;
  }

  .message-avatar {
    width: 28px;
    height: 28px;
  }

  .avatar-circle {
    width: 28px;
    height: 28px;
  }
}
</style>
