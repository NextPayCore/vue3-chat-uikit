import type { MessageStatusEnum } from '../enums/message.enum'
import type { IUser } from './user.interface'

// Message types based on CHAT_API_DOCUMENTATION.md
export type MessageType = 'text' | 'image' | 'file' | 'system'

// Chat message interface (from API documentation)
export interface IChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName?: string
  senderAvatar?: string
  content: string
  type: MessageType
  fileUrl?: string
  fileName?: string
  readBy: string[]
  replyTo?: string
  replyToMessage?: IChatMessage
  isEdited: boolean
  isDeleted: boolean
  editedAt?: Date
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Legacy message interface (for existing ChatList/ChatInput components)
export interface IMessage {
  id: string
  contentText?: string
  sender: IUser
  receiver?: IUser
  status: MessageStatusEnum
  attachments?: IAttachment[]
  replyTo?: IMessage
  mentions?: IUser[]
  createdAt: Date
  updatedAt: Date
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  type?: 'text' | 'image' | 'audio' | 'video' | 'file'
  fileUrl?: string
  fileName?: string
  isTyping?: boolean
  avatar?: string
  metadata?: Record<string, any>
  selectedText?: string
}

export interface IAttachment {
  id?: string
  name: string // filename
  url: string // url
  mimeType: string // mime type
  size?: number // size in bytes
  width?: number // width in pixels
  height?: number // height in pixels
  duration?: number // duration in seconds
  thumbnailUrl?: string // thumbnail url
}

export interface IMessageShow extends IMessage {
  isMe: boolean
  contentHtml?: string
}

// Message history response interface
export interface IMessageHistory {
  conversation: {
    id: string
    type: 'private' | 'group'
    participants: string[]
    name?: string
    description?: string
    avatar?: string
  }
  messages: IChatMessage[]
  totalMessages: number
  page: number
  limit: number
}

// Send message payload
export interface ISendMessagePayload {
  content: string
  type?: MessageType
  fileUrl?: string
  fileName?: string
  replyTo?: string
}

// Edit message payload
export interface IEditMessagePayload {
  content: string
}

// Message read data
export interface IMessageReadData {
  messageId: string
  readBy: Array<{
    userId: string
    readAt: Date
  }>
}

