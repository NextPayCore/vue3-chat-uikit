import type { IUser } from './user.interface'
import type { IMessage } from './message.interface'

export type ConversationType = 'private' | 'group'

export interface IUserInfo {
  id: string
  name: string
  email: string
  avatar?: string
}

export interface IPresenceInfo {
  onlineCount: number
  offlineCount: number
  onlineUsers: string[]
}

export interface IConversation {
  _id: string
  type: ConversationType
  name?: string
  description?: string
  avatar?: string
  participants: IUser[]
  participantIds: string[]
  // Detailed API fields
  participantsInfo?: IUserInfo[]
  creatorInfo?: IUserInfo
  participantCount?: number
  presenceInfo?: IPresenceInfo
  // End detailed fields
  createdBy: string
  lastMessage?: IMessage
  lastMessageAt?: Date
  unreadCount?: number
  createdAt: Date
  updatedAt: Date
  metadata?: {
    isActive?: boolean
    isMuted?: boolean
    mutedUntil?: Date
    isPinned?: boolean
  }
}

export interface ICreateConversationRequest {
  type: ConversationType
  participantIds: string[]
  name?: string
  description?: string
  avatar?: string
}

export interface IConversationListResponse {
  conversations: IConversation[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
