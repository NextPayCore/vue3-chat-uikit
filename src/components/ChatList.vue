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
          message.sender.id === currentUser?.id ? 'user-message' : 'assistant-message'
        ]"
      >
        <div class="message-content" :class="[
          message.sender.id === currentUser?.id ? 'message-content-right' : ''
        ]"    >
          <!-- Avatar for other user messages -->
          <div v-if="message.sender.id !== currentUser?.id" class="message-avatar">
            <el-avatar :src="message.sender.avatarUrl" :size="32" class="avatar-circle">
              {{ message.sender.name?.charAt(0) || '?' }}
            </el-avatar>
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
          </div>

          <!-- Avatar for current user messages -->
          <div v-if="message.sender.id === currentUser?.id" class="message-avatar user-avatar">
            <el-avatar :src="currentUser?.avatarUrl" :size="32" class="avatar-circle user-avatar-circle">
              {{ currentUser?.name?.charAt(0) || 'U' }}
            </el-avatar>
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
import { ElIcon, ElMessage, ElProgress, ElAvatar } from 'element-plus'
import { Document, Microphone, CopyDocument, ChatLineRound } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import type { IMessage } from '../interfaces/message.interface'
import { useAuth } from '@/composables/useAuth'

// Initialize markdown parser with options
const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight: function (str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code class="language-' + lang + '">' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>'
      } catch (__) {
        // Ignore errors
      }
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
  }
})

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
const { currentUser } = useAuth()
console.log(currentUser)
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

const formatMessage = (content: string): string => {
  // Use markdown-it to parse and render markdown
  return md.render(content)
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
/* Import highlight.js theme */
@import 'highlight.js/styles/github-dark.css';

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
  line-height: 1.6;
  word-wrap: break-word;
  user-select: text;
  cursor: text;
}

/* Markdown Typography */
.message-text :deep(h1),
.message-text :deep(h2),
.message-text :deep(h3),
.message-text :deep(h4),
.message-text :deep(h5),
.message-text :deep(h6) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
  line-height: 1.3;
  color: inherit;
}

.message-text :deep(h1) { font-size: 24px; }
.message-text :deep(h2) { font-size: 20px; }
.message-text :deep(h3) { font-size: 18px; }
.message-text :deep(h4) { font-size: 16px; }
.message-text :deep(h5) { font-size: 15px; }
.message-text :deep(h6) { font-size: 14px; }

.message-text :deep(p) {
  margin: 8px 0;
}

.message-text :deep(strong) {
  font-weight: 600;
}

.message-text :deep(em) {
  font-style: italic;
}

.message-text :deep(a) {
  color: #10a37f;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.message-text :deep(a:hover) {
  border-bottom-color: #10a37f;
}

.user-message .message-text :deep(a) {
  color: rgba(255, 255, 255, 0.9);
  border-bottom-color: rgba(255, 255, 255, 0.3);
}

.user-message .message-text :deep(a:hover) {
  border-bottom-color: rgba(255, 255, 255, 0.9);
}

/* Inline code */
.message-text :deep(code:not(.hljs)) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
  font-size: 13px;
  color: #d73a49;
}

.user-message .message-text :deep(code:not(.hljs)) {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.95);
}

/* Code blocks */
.message-text :deep(pre) {
  margin: 12px 0;
  padding: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #1e1e1e;
}

.message-text :deep(pre code) {
  display: block;
  padding: 16px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: transparent;
  color: #d4d4d4;
}

/* Lists */
.message-text :deep(ul),
.message-text :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.message-text :deep(li) {
  margin: 4px 0;
}

.message-text :deep(ul) {
  list-style-type: disc;
}

.message-text :deep(ol) {
  list-style-type: decimal;
}

.message-text :deep(li > ul),
.message-text :deep(li > ol) {
  margin: 4px 0;
}

/* Blockquotes */
.message-text :deep(blockquote) {
  margin: 12px 0;
  padding: 8px 16px;
  border-left: 4px solid #10a37f;
  background: rgba(16, 163, 127, 0.05);
  border-radius: 4px;
  color: inherit;
}

.user-message .message-text :deep(blockquote) {
  border-left-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.1);
}

.message-text :deep(blockquote p) {
  margin: 4px 0;
}

/* Horizontal rule */
.message-text :deep(hr) {
  margin: 16px 0;
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.user-message .message-text :deep(hr) {
  border-top-color: rgba(255, 255, 255, 0.2);
}

/* Tables */
.message-text :deep(table) {
  margin: 12px 0;
  border-collapse: collapse;
  width: 100%;
  overflow-x: auto;
  display: block;
  max-width: 100%;
}

.message-text :deep(table thead) {
  background: rgba(0, 0, 0, 0.05);
}

.user-message .message-text :deep(table thead) {
  background: rgba(255, 255, 255, 0.1);
}

.message-text :deep(table th),
.message-text :deep(table td) {
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  text-align: left;
}

.user-message .message-text :deep(table th),
.user-message .message-text :deep(table td) {
  border-color: rgba(255, 255, 255, 0.2);
}

.message-text :deep(table th) {
  font-weight: 600;
}

/* Images */
.message-text :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 8px 0;
}

/* Task lists */
.message-text :deep(input[type="checkbox"]) {
  margin-right: 6px;
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
