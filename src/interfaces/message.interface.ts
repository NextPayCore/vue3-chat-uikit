import type { MessageStatusEnum } from '../enums/message.enum'

export interface IMessage {
  id: string
  contentText?: string
  sender: string
  receiver?: string
  status: MessageStatusEnum
  attachments?: IAttachment[]
  replyTo?: IMessage
  mentions?: string[]
  createdAt: Date
  updatedAt: Date
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
