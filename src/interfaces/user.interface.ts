export interface IUser {
  id: string
  name: string
  email?: string
  avatar?: string
  avatarUrl?: string
  isOnline?: boolean
  lastSeen?: string
  lastActiveAt?: Date
  isPrivate?: boolean
  allowFriendRequests?: boolean
  friendshipStatus?: 'pending' | 'accepted' | 'received' | 'blocked'
  metadata?: Record<string, any>
}
