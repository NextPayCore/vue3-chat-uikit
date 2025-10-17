<template>
  <div class="chat-input-container">
    <!-- File preview area -->
    <div v-if="uploadedFiles.length > 0" class="file-preview-area">
      <div v-for="file in uploadedFiles" :key="file.id" class="file-preview-item">
        <div v-if="file.type.startsWith('image/')" class="image-preview">
          <img :src="file.preview" :alt="file.name" />
          <div class="file-overlay">
            <span class="file-name">{{ file.name }}</span>
            <el-button
              size="small"
              type="danger"
              circle
              class="remove-file-btn"
              @click="removeFile(file.id)"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
        <div v-else class="file-preview">
          <div class="file-icon">
            <el-icon><Document /></el-icon>
          </div>
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
          </div>
          <el-button
            size="small"
            type="danger"
            circle
            class="remove-file-btn"
            @click="removeFile(file.id)"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- Voice recording preview -->
    <div v-if="currentVoiceRecording" class="voice-preview-area">
      <div class="voice-preview-item">
        <div class="voice-icon">
          <el-icon><Microphone /></el-icon>
        </div>
        <div class="voice-info">
          <span class="voice-label">Voice Message</span>
          <span class="voice-duration">{{ currentVoiceRecording.duration }}s</span>
        </div>
        <audio :src="currentVoiceRecording.url" controls class="voice-player"></audio>
        <el-button
          size="small"
          type="danger"
          circle
          class="remove-voice-btn"
          @click="clearVoiceRecording"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- Reply preview -->
    <div v-if="replyTo" class="reply-preview-area">
      <div class="reply-preview-item">
        <div class="reply-indicator">
          <div class="reply-line"></div>
          <div class="reply-content">
            <div class="reply-header">
              <span class="reply-to">
                Replying to {{ replyTo.role === 'user' ? 'yourself' : 'Assistant' }}
                <span v-if="replyTo.selectedText" class="reply-type"> (selected text)</span>
              </span>
              <el-button
                size="small"
                type="danger"
                circle
                class="cancel-reply-btn"
                @click="cancelReply"
              >
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
            <div class="reply-message">
              <span v-if="replyTo.selectedText" class="selected-quote">
                "{{ replyTo.selectedText }}"
              </span>
              <span v-else>{{ truncateText(replyTo.content, 150) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Markdown toolbar -->
    <div class="markdown-toolbar">
      <div class="toolbar-buttons">
        <button
          @click="insertMarkdown('bold')"
          class="md-btn"
          title="Bold (Ctrl/Cmd + B)"
          type="button"
        >
          <strong>B</strong>
        </button>
        <button
          @click="insertMarkdown('italic')"
          class="md-btn"
          title="Italic (Ctrl/Cmd + I)"
          type="button"
        >
          <em>I</em>
        </button>
        <button
          @click="insertMarkdown('code')"
          class="md-btn"
          title="Inline Code"
          type="button"
        >
          &lt;/&gt;
        </button>
        <button
          @click="insertMarkdown('codeblock')"
          class="md-btn"
          title="Code Block"
          type="button"
        >
          { }
        </button>
        <button
          @click="insertMarkdown('link')"
          class="md-btn"
          title="Link"
          type="button"
        >
          🔗
        </button>
        <button
          @click="insertMarkdown('list')"
          class="md-btn"
          title="List"
          type="button"
        >
          ≡
        </button>
        <button
          @click="insertMarkdown('quote')"
          class="md-btn"
          title="Quote"
          type="button"
        >
          "
        </button>
      </div>
      <span class="markdown-hint">Markdown supported</span>
      <el-button
        size="small"
        text
        class="preview-toggle"
        @click="togglePreview"
        :title="isPreviewMode ? 'Edit Mode' : 'Preview Mode'"
      >
        <el-icon v-if="isPreviewMode"><Edit /></el-icon>
        <el-icon v-else><View /></el-icon>
        <span>{{ isPreviewMode ? 'Edit' : 'Preview' }}</span>
      </el-button>
    </div>

    <div class="input-wrapper">
      <!-- File input (hidden) -->
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
        class="hidden-file-input"
        @change="handleFileSelect"
      />

      <el-input
        v-show="!isPreviewMode"
        ref="inputRef"
        v-model="message"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 6 }"
        :placeholder="placeholder"
        class="chat-input"
        @keydown="handleKeydown"
        @input="handleInput"
        :disabled="disabled"
        resize="none"
      />

      <!-- Markdown Preview Area -->
      <div
        v-show="isPreviewMode"
        class="markdown-preview"
        :class="{ 'empty': !message.trim() }"
      >
        <div v-if="message.trim()" class="preview-content" v-html="markdownPreview"></div>
        <div v-else class="preview-placeholder">{{ placeholder }}</div>
      </div>

      <div class="input-actions">
        <!-- File upload button -->
        <el-button
          size="small"
          circle
          class="upload-button"
          @click="triggerFileUpload"
          :disabled="disabled"
        >
          <el-icon><Paperclip /></el-icon>
        </el-button>

        <!-- Voice recording button -->
        <el-button
          size="small"
          circle
          :class="['voice-button', { 'recording': isRecording }]"
          @mousedown="startRecording"
          @mouseup="stopRecording"
          @mouseleave="stopRecording"
          @touchstart="startRecording"
          @touchend="stopRecording"
          :disabled="disabled"
        >
          <el-icon v-if="!isRecording"><Microphone /></el-icon>
          <el-icon v-else><VideoPause /></el-icon>
        </el-button>

        <!-- Send button -->
        <el-button
          :disabled="!canSend"
          type="primary"
          circle
          size="small"
          class="send-button"
          @click="sendMessage"
        >
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="input-footer">
      <span class="disclaimer">
        ChatGPT can make mistakes. Check important info.
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { ElInput, ElButton, ElIcon } from 'element-plus'
import { ArrowRight, Paperclip, Close, Document, Microphone, VideoPause, View, Edit } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

// Initialize markdown parser
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

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  file: File
  preview?: string
}

interface VoiceRecording {
  id: string
  blob: Blob
  duration: number
  url: string
}

interface ChatInputProps {
  disabled?: boolean
  placeholder?: string
  maxFileSize?: number // in MB
  allowedFileTypes?: string[]
  maxRecordingTime?: number // in seconds
  replyTo?: {
    id: string
    content: string
    role: 'user' | 'assistant'
    timestamp: Date
    selectedText?: string
  } | null
}

interface ChatInputEmits {
  (e: 'send', data: { message: string; files: UploadedFile[]; voice?: VoiceRecording }): void
  (e: 'typing', isTyping: boolean): void
  (e: 'fileUpload', files: UploadedFile[]): void
  (e: 'voiceStart'): void
  (e: 'voiceEnd', recording: VoiceRecording): void
  (e: 'cancelReply'): void
}

const props = withDefaults(defineProps<ChatInputProps>(), {
  disabled: false,
  placeholder: 'Message ChatGPT...',
  maxFileSize: 10, // 10MB default
  allowedFileTypes: () => ['image/*', '.pdf', '.doc', '.docx', '.txt', '.csv', '.xlsx', '.xls'],
  maxRecordingTime: 60 // 60 seconds default
})

const emit = defineEmits<ChatInputEmits>()

const message = ref('')
const uploadedFiles = ref<UploadedFile[]>([])
const inputRef = ref<InstanceType<typeof ElInput>>()
const fileInputRef = ref<HTMLInputElement>()
const isPreviewMode = ref(false)

// Voice recording states
const isRecording = ref(false)
const mediaRecorder = ref<MediaRecorder | null>(null)
const audioChunks = ref<Blob[]>([])
const recordingStartTime = ref<number>(0)
const recordingTimer = ref<NodeJS.Timeout | null>(null)
const currentVoiceRecording = ref<VoiceRecording | null>(null)

const canSend = computed(() => {
  return (
    message.value.trim().length > 0 ||
    uploadedFiles.value.length > 0 ||
    currentVoiceRecording.value !== null
  ) && !props.disabled && !isRecording.value
})

const markdownPreview = computed(() => {
  if (!message.value.trim()) return ''
  return md.render(message.value)
})

const togglePreview = () => {
  isPreviewMode.value = !isPreviewMode.value
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (canSend.value) {
      sendMessage()
    }
  }
}

const handleInput = () => {
  emit('typing', message.value.length > 0)
}

const startRecording = async () => {
  if (props.disabled || isRecording.value) return

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    mediaRecorder.value = new MediaRecorder(stream)
    audioChunks.value = []

    mediaRecorder.value.ondataavailable = (event) => {
      audioChunks.value.push(event.data)
    }

    mediaRecorder.value.onstop = async () => {
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/wav' })
      const duration = Date.now() - recordingStartTime.value

      const recording: VoiceRecording = {
        id: Date.now().toString(),
        blob: audioBlob,
        duration: Math.floor(duration / 1000),
        url: URL.createObjectURL(audioBlob)
      }

      currentVoiceRecording.value = recording
      emit('voiceEnd', recording)

      // Stop all tracks to release microphone
      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.value.start()
    isRecording.value = true
    recordingStartTime.value = Date.now()
    emit('voiceStart')

    // Auto stop after max recording time
    recordingTimer.value = setTimeout(() => {
      stopRecording()
    }, props.maxRecordingTime * 1000)

  } catch (error) {
    console.error('Error accessing microphone:', error)
    // You might want to show an error message to user
  }
}

const stopRecording = () => {
  if (!isRecording.value || !mediaRecorder.value) return

  mediaRecorder.value.stop()
  isRecording.value = false

  if (recordingTimer.value) {
    clearTimeout(recordingTimer.value)
    recordingTimer.value = null
  }
}

const clearVoiceRecording = () => {
  if (currentVoiceRecording.value) {
    URL.revokeObjectURL(currentVoiceRecording.value.url)
    currentVoiceRecording.value = null
  }
}

const triggerFileUpload = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files

  if (!files || files.length === 0) return

  const newFiles: UploadedFile[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]

    // Check file size
    if (file.size > props.maxFileSize * 1024 * 1024) {
      // You might want to show an error message here
      console.warn(`File ${file.name} is too large. Maximum size is ${props.maxFileSize}MB`)
      continue
    }

    const fileData: UploadedFile = {
      id: Date.now().toString() + i,
      name: file.name,
      size: file.size,
      type: file.type,
      file: file
    }

    // Create preview for images
    if (file.type.startsWith('image/')) {
      fileData.preview = await createImagePreview(file)
    }

    newFiles.push(fileData)
  }

  uploadedFiles.value.push(...newFiles)
  emit('fileUpload', uploadedFiles.value)

  // Clear the input
  target.value = ''
}

const createImagePreview = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.readAsDataURL(file)
  })
}

const removeFile = (fileId: string) => {
  uploadedFiles.value = uploadedFiles.value.filter(f => f.id !== fileId)
  emit('fileUpload', uploadedFiles.value)
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const cancelReply = () => {
  emit('cancelReply')
}

const insertMarkdown = (type: string) => {
  const textarea = inputRef.value?.textarea
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = message.value.substring(start, end)
  const beforeText = message.value.substring(0, start)
  const afterText = message.value.substring(end)

  let newText = ''
  let cursorOffset = 0

  switch (type) {
    case 'bold':
      newText = `**${selectedText || 'bold text'}**`
      cursorOffset = selectedText ? newText.length : 2
      break
    case 'italic':
      newText = `*${selectedText || 'italic text'}*`
      cursorOffset = selectedText ? newText.length : 1
      break
    case 'code':
      newText = `\`${selectedText || 'code'}\``
      cursorOffset = selectedText ? newText.length : 1
      break
    case 'codeblock':
      newText = `\`\`\`\n${selectedText || 'code block'}\n\`\`\``
      cursorOffset = selectedText ? newText.length : 4
      break
    case 'link':
      newText = `[${selectedText || 'link text'}](url)`
      cursorOffset = selectedText ? newText.length - 4 : 1
      break
    case 'list':
      newText = `- ${selectedText || 'list item'}`
      cursorOffset = selectedText ? newText.length : 2
      break
    case 'quote':
      newText = `> ${selectedText || 'quote'}`
      cursorOffset = selectedText ? newText.length : 2
      break
    default:
      return
  }

  message.value = beforeText + newText + afterText

  nextTick(() => {
    const newPosition = start + cursorOffset
    textarea.focus()
    textarea.setSelectionRange(newPosition, newPosition)
  })
}

const sendMessage = () => {
  if (!canSend.value) return

  const messageText = message.value.trim()
  const files = [...uploadedFiles.value]
  const voice = currentVoiceRecording.value

  if (messageText || files.length > 0 || voice) {
    emit('send', { message: messageText, files, voice: voice || undefined })
    message.value = ''
    uploadedFiles.value = []
    clearVoiceRecording()

    nextTick(() => {
      inputRef.value?.focus()
    })
  }
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  clear: () => {
    message.value = ''
    uploadedFiles.value = []
    clearVoiceRecording()
  },
  stopRecording
})
</script>

<style scoped>
/* Import highlight.js theme for code blocks */
@import 'highlight.js/styles/github-dark.css';

.chat-input-container {
  flex-shrink: 0;
  width: 100%;
  max-width: 768px;
  margin: 0 auto;
  padding: 20px 24px 24px;
  background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,1) 100%);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0,0,0,0.06);
}

.markdown-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.toolbar-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.md-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.md-btn:hover {
  background: #f3f4f6;
  border-color: #10a37f;
  color: #10a37f;
  transform: translateY(-1px);
}

.md-btn:active {
  transform: translateY(0);
}

.md-btn strong,
.md-btn em {
  font-size: 14px;
}

.markdown-hint {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 500;
  letter-spacing: 0.025em;
}

.preview-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: #6b7280;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  border-radius: 6px;
}

.preview-toggle:hover {
  color: #10a37f;
  background: rgba(16, 163, 127, 0.05);
  border-color: rgba(16, 163, 127, 0.2);
}

.preview-toggle .el-icon {
  font-size: 14px;
}

.markdown-preview {
  min-height: 40px;
  max-height: 200px;
  overflow-y: auto;
  padding: 12px 16px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 15px;
  line-height: 1.6;
  transition: all 0.2s ease;
}

.markdown-preview:hover {
  border-color: #10a37f;
}

.markdown-preview.empty {
  border-style: dashed;
  border-color: #d1d5db;
}

.preview-placeholder {
  color: #9ca3af;
  font-style: italic;
}

.preview-content {
  word-wrap: break-word;
}

/* Markdown styling for preview */
.preview-content :deep(h1),
.preview-content :deep(h2),
.preview-content :deep(h3),
.preview-content :deep(h4),
.preview-content :deep(h5),
.preview-content :deep(h6) {
  margin-top: 12px;
  margin-bottom: 6px;
  font-weight: 600;
  line-height: 1.3;
  color: #1f2937;
}

.preview-content :deep(h1) { font-size: 20px; }
.preview-content :deep(h2) { font-size: 18px; }
.preview-content :deep(h3) { font-size: 16px; }
.preview-content :deep(h4) { font-size: 15px; }

.preview-content :deep(p) {
  margin: 6px 0;
}

.preview-content :deep(strong) {
  font-weight: 600;
}

.preview-content :deep(em) {
  font-style: italic;
}

.preview-content :deep(a) {
  color: #10a37f;
  text-decoration: underline;
}

.preview-content :deep(code:not(.hljs)) {
  background: rgba(0, 0, 0, 0.08);
  padding: 2px 5px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  color: #d73a49;
}

.preview-content :deep(pre) {
  margin: 8px 0;
  padding: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #1e1e1e;
}

.preview-content :deep(pre code) {
  display: block;
  padding: 12px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.5;
  background: transparent;
  color: #d4d4d4;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.preview-content :deep(li) {
  margin: 3px 0;
}

.preview-content :deep(blockquote) {
  margin: 8px 0;
  padding: 6px 12px;
  border-left: 3px solid #10a37f;
  background: rgba(16, 163, 127, 0.05);
  border-radius: 3px;
}

.preview-content :deep(hr) {
  margin: 12px 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}

.preview-content :deep(table) {
  margin: 8px 0;
  border-collapse: collapse;
  width: 100%;
  font-size: 14px;
}

.preview-content :deep(table th),
.preview-content :deep(table td) {
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  text-align: left;
}

.preview-content :deep(table th) {
  background: rgba(0, 0, 0, 0.03);
  font-weight: 600;
}

.preview-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 6px 0;
}

/* Scrollbar for preview */
.markdown-preview::-webkit-scrollbar {
  width: 6px;
}

.markdown-preview::-webkit-scrollbar-track {
  background: transparent;
}

.markdown-preview::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.markdown-preview::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.file-preview-area {
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.file-preview-item {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #f7fafc;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-preview-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.image-preview {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.image-preview:hover img {
  transform: scale(1.05);
}

.file-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  color: white;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-preview {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
  min-width: 220px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-preview:hover {
  border-color: #cbd5e0;
}

.file-icon {
  color: #4a5568;
  font-size: 28px;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-name {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.file-size {
  font-size: 12px;
  color: #718096;
  font-weight: 500;
}

.remove-file-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(245, 101, 101, 0.1);
  color: #f56565;
  border-radius: 14px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.remove-file-btn:hover {
  background: rgba(245, 101, 101, 0.2);
  transform: scale(1.1);
}

.voice-preview-area {
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.voice-preview-item {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 300px;
}

.voice-preview-item:hover {
  border-color: #cbd5e0;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.voice-icon {
  color: #10a37f;
  font-size: 24px;
  padding: 8px;
  background: rgba(16, 163, 127, 0.1);
  border-radius: 50%;
}

.voice-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.voice-label {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

.voice-duration {
  font-size: 12px;
  color: #718096;
  font-weight: 500;
}

.voice-player {
  height: 32px;
  border-radius: 16px;
}

.remove-voice-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(245, 101, 101, 0.1);
  color: #f56565;
  border-radius: 14px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.remove-voice-btn:hover {
  background: rgba(245, 101, 101, 0.2);
  transform: scale(1.1);
}

.hidden-file-input {
  display: none;
}

.input-wrapper {
  position: relative;
  background: #ffffff;
  border: 2px solid #e1e5e9;
  border-radius: 28px;
  padding: 14px 140px 14px 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.input-wrapper:hover {
  border-color: #c1c7cd;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.input-wrapper:focus-within {
  border-color: #10a37f;
  box-shadow: 0 0 0 4px rgba(16, 163, 127, 0.12), 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

:deep(.chat-input) {
  background: transparent;
  border: none;
  outline: none;
}

:deep(.chat-input .el-textarea__inner) {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 16px;
  line-height: 28px;
  color: #2d3748;
  resize: none;
  box-shadow: none;
  min-height: 28px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  font-weight: 400;
}

:deep(.chat-input .el-textarea__inner:focus) {
  box-shadow: none;
  outline: none;
}

:deep(.chat-input .el-textarea__inner::placeholder) {
  color: #a0aec0;
  font-weight: 400;
}

.input-actions {
  position: absolute;
  right: 12px;
  bottom: 50%;
  transform: translateY(50%);
  display: flex;
  align-items: center;
  gap: 8px;
}

.upload-button {
  width: 36px;
  height: 36px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  color: #718096;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 18px;
}

.upload-button:hover:not(:disabled) {
  background: #edf2f7;
  border-color: #cbd5e0;
  color: #4a5568;
  transform: scale(1.05);
}

.voice-button {
  width: 36px;
  height: 36px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  color: #718096;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 18px;
}

.voice-button:hover:not(:disabled) {
  background: #edf2f7;
  border-color: #cbd5e0;
  color: #4a5568;
  transform: scale(1.05);
}

.voice-button.recording {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border-color: #ef4444;
  color: white;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.send-button {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #10a37f 0%, #0d8f6c 100%);
  border: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 18px;
  box-shadow: 0 2px 8px rgba(16, 163, 127, 0.3);
}

.send-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #0d8f6c 0%, #0a7c5a 100%);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(16, 163, 127, 0.4);
}

.send-button:disabled {
  background: #e2e8f0;
  border: none;
  color: #a0aec0;
  box-shadow: none;
  transform: none;
}

.input-footer {
  text-align: center;
  padding-top: 16px;
}

.disclaimer {
  font-size: 13px;
  color: #718096;
  font-weight: 400;
  opacity: 0.8;
}

.reply-preview-area {
  margin-bottom: 16px;
}

.reply-preview-item {
  background: rgba(16, 163, 127, 0.05);
  border: 1px solid rgba(16, 163, 127, 0.15);
  border-radius: 12px;
  padding: 12px 16px;
}

.reply-indicator {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.reply-line {
  width: 3px;
  height: 100%;
  background: #10a37f;
  border-radius: 2px;
  margin-top: 4px;
  min-height: 40px;
}

.reply-content {
  flex: 1;
  min-width: 0;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.reply-to {
  font-size: 12px;
  font-weight: 600;
  color: #10a37f;
}

.cancel-reply-btn {
  width: 20px;
  height: 20px;
  font-size: 12px;
  border: none;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.cancel-reply-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #dc2626;
}

.reply-message {
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
  word-break: break-word;
}

.reply-type {
  font-weight: normal;
  opacity: 0.8;
  font-size: 11px;
}

.selected-quote {
  font-style: italic;
  background: rgba(16, 163, 127, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  border-left: 2px solid #10a37f;
  display: inline-block;
}

@media (max-width: 768px) {
  .chat-input-container {
    padding: 16px 20px 20px;
  }

  .markdown-toolbar {
    padding: 6px 8px;
    margin-bottom: 10px;
  }

  .toolbar-buttons {
    gap: 3px;
  }

  .md-btn {
    min-width: 26px;
    height: 26px;
    font-size: 12px;
  }

  .markdown-hint {
    font-size: 10px;
  }

  .preview-toggle {
    font-size: 11px;
    padding: 3px 6px;
  }

  .markdown-preview {
    min-height: 36px;
    max-height: 150px;
    padding: 10px 12px;
    font-size: 14px;
  }

  .input-wrapper {
    padding: 12px 130px 12px 18px;
    border-radius: 24px;
  }

  .input-actions {
    right: 10px;
    gap: 6px;
  }

  .upload-button,
  .voice-button,
  .send-button {
    width: 32px;
    height: 32px;
    border-radius: 16px;
  }

  .file-preview-area {
    gap: 8px;
  }

  .image-preview {
    width: 90px;
    height: 90px;
  }

  .file-preview {
    min-width: 180px;
    padding: 12px;
  }

  .file-name {
    max-width: 120px;
  }

  .voice-preview-item {
    min-width: 280px;
    padding: 12px;
  }

  .voice-player {
    height: 28px;
  }

  :deep(.chat-input .el-textarea__inner) {
    font-size: 16px;
    line-height: 24px;
  }
}
</style>
