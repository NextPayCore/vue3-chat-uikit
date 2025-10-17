import type { IAttachment } from './message.interface'
import type { IMessage } from './message.interface'

export interface IChatInput {
  messageText: string
  mentions?: string[]
  attachments?: IAttachment[]
  replyTo?: IMessage
}

export interface IUploadedFile {
  id: string
  name: string
  size: number
  type: string
  file: File
  preview?: string
}
