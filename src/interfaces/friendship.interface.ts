export type FriendshipStatus = 'pending' | 'accepted' | 'blocked' | 'declined'

export interface IFriendship {
  _id: string
  requesterId: string
  addresseeId: string
  status: FriendshipStatus
  message?: string
  createdAt: Date
  updatedAt: Date
  acceptedAt?: Date
  blockedAt?: Date
  declinedAt?: Date
}

export interface IFriendUser {
  id: string
  name: string
  email: string
  avatar?: string
  avatarUrl?: string
  isOnline: boolean
  lastSeen?: Date
  friendshipId?: string
  friendshipStatus?: FriendshipStatus
  mutualFriendsCount?: number
}

export interface IFriendshipList {
  friends: IFriendUser[]
  pendingRequests: IFriendship[]
  sentRequests: IFriendship[]
  blockedUsers: IFriendUser[]
  totalFriends: number
  totalPending: number
  totalBlocked: number
}

// Response from /api/friendship/list endpoint (simplified version with just IDs)
export interface IFriendshipListSimple {
  friends: string[]  // Array of friend user IDs
  totalFriends: number
  pendingRequests: string[]  // Array of pending request IDs
  totalPendingRequests: number
}

export interface ISuggestedFriend extends IFriendUser {
  reason?: string
  mutualFriends?: string[]
}

export interface IFriendshipCheckResponse {
  isFriend: boolean
  status?: FriendshipStatus
  friendshipId?: string
  canSendRequest: boolean
  isBlocked: boolean
  blockedBy?: 'requester' | 'addressee'
}
