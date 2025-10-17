import type { MessageStatusEnum } from '../enums/message.enum'
import type { IUser } from './user.interface'

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
  type?: 'text' | 'image' | 'audio' | 'video'
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
