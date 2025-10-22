/**
 * Conversation Parser Utilities
 *
 * Utilities for parsing and enriching conversation data,
 * particularly handling participant fields from backend.
 */

import type { IUser } from '../interfaces/user.interface'

/**
 * Parse createdBy field from MongoDB toString format
 *
 * Handles format: "{\n  _id: new ObjectId('...'),\n  name: '...',\n  email: '...',\n  avatar: '...'\n}"
 *
 * @param createdByString - The createdBy string from backend
 * @returns Parsed user object or null
 */
export function parseCreatedByUser(createdByString: string | null | undefined): IUser | null {
  if (!createdByString || typeof createdByString !== 'string') {
    return null
  }

  try {
    // Extract _id
    const idMatch = createdByString.match(/_id:\s*new ObjectId\('([a-f0-9]{24})'\)/i)
    const id = idMatch ? idMatch[1] : null

    // Extract name
    const nameMatch = createdByString.match(/name:\s*'([^']+)'/i)
    const name = nameMatch ? nameMatch[1] : null

    // Extract email
    const emailMatch = createdByString.match(/email:\s*'([^']+)'/i)
    const email = emailMatch ? emailMatch[1] : null

    // Extract avatar
    const avatarMatch = createdByString.match(/avatar:\s*'([^']+)'/i)
    const avatar = avatarMatch ? avatarMatch[1] : null

    if (!id || !name) {
      console.warn('⚠️ Could not parse createdBy - missing id or name')
      return null
    }

    const user: IUser = {
      id,
      name,
      email: email || undefined,
      avatarUrl: avatar || undefined,
      isOnline: false
    }

    return user
  } catch (error) {
    console.error('❌ Error parsing createdBy:', error)
    return null
  }
}

/**
 * Parse participants field from conversation API response
 *
 * Handles three formats:
 * 1. Array of user IDs (strings): ["68f5d531334e1cfa50f451a6", ...]
 * 2. Array of populated user objects: [{id: "...", name: "...", ...}, ...]
 * 3. Array of stringified MongoDB objects: ["{\n  _id: new ObjectId('...'),\n  name: '...',\n  ...}", ...]
 *
 * @param participants - Raw participants data from backend
 * @returns Array of user objects (minimal or full)
 */
export function parseParticipants(participants: any[]): IUser[] {
  if (!participants || participants.length === 0) {
    return []
  }

  // Check first item to determine format
  const firstItem = participants[0]

  // Case 1: String IDs (24 char hex) - create minimal user objects
  if (typeof firstItem === 'string' && /^[a-f0-9]{24}$/i.test(firstItem)) {
    return participants.map((userId: string) => ({
      id: userId,
      name: userId.substring(0, 8) + '...', // Temporary: show part of ID
      email: '',
      avatarUrl: '',
      isOnline: false
    }))
  }

  // Case 2: Stringified MongoDB objects - parse them
  if (typeof firstItem === 'string' && firstItem.includes('ObjectId')) {
    console.log('📋 Parsing stringified MongoDB participants:', participants)
    return participants
      .map((participantStr: string): IUser | null => {
        try {
          // Extract _id
          const idMatch = participantStr.match(/_id:\s*new ObjectId\('([a-f0-9]{24})'\)/i)
          const id = idMatch ? idMatch[1] : null

          // Extract name
          const nameMatch = participantStr.match(/name:\s*'([^']+)'/i)
          const name = nameMatch ? nameMatch[1] : null

          // Extract email
          const emailMatch = participantStr.match(/email:\s*'([^']+)'/i)
          const email = emailMatch ? emailMatch[1] : ''

          // Extract avatar
          const avatarMatch = participantStr.match(/avatar:\s*'([^']+)'/i)
          const avatar = avatarMatch ? avatarMatch[1] : ''

          if (!id) {
            console.warn('⚠️ Could not extract ID from participant string:', participantStr)
            return null
          }

          const user: IUser = {
            id,
            name: name || 'Unknown User',
            email,
            avatarUrl: avatar,
            isOnline: false
          }

          console.log('✅ Parsed participant:', user)
          return user
        } catch (error) {
          console.error('❌ Error parsing participant string:', error, participantStr)
          return null
        }
      })
      .filter((user): user is IUser => user !== null)
  }

  // Case 3: Already populated objects
  if (typeof firstItem === 'object' && (firstItem.id || firstItem._id)) {
    return participants.map((user: any) => ({
      id: user.id || user._id,
      name: user.name || user.username || 'Unknown',
      email: user.email || '',
      avatarUrl: user.avatarUrl || user.avatar || '',
      isOnline: user.isOnline || false
    }))
  }

  // Unknown format, return empty
  console.warn('⚠️ Unknown participants format:', firstItem)
  return []
}

/**
 * Enrich user object with cached data
 *
 * Merges cached user details (from friends list, messages, etc.)
 * with existing user data, preferring cached values.
 *
 * @param user - Original user object
 * @param userCache - Map of cached user data by ID
 * @returns Enriched user object
 */
export function enrichUserWithCache(user: IUser, userCache: Map<string, any>): IUser {
  const cachedUser = userCache.get(user.id)

  if (!cachedUser) {
    return user
  }

  return {
    ...user,
    name: cachedUser.name || user.name,
    email: cachedUser.email || user.email,
    avatarUrl: cachedUser.avatarUrl || cachedUser.avatar || user.avatarUrl,
    isOnline: cachedUser.isOnline ?? user.isOnline
  }
}

/**
 * Enrich array of users with cached data
 *
 * @param users - Array of user objects
 * @param userCache - Map of cached user data by ID
 * @returns Array of enriched user objects
 */
export function enrichUsersWithCache(users: IUser[], userCache: Map<string, any>): IUser[] {
  return users.map(user => enrichUserWithCache(user, userCache))
}

/**
 * Extract participant IDs from various formats
 *
 * @param participants - Raw participants data (IDs or objects)
 * @returns Array of user IDs
 */
export function extractParticipantIds(participants: any[]): string[] {
  if (!participants || participants.length === 0) {
    return []
  }

  return participants.map((p: any) => {
    if (typeof p === 'string') {
      return p
    }
    return p.id || p._id || ''
  }).filter(Boolean)
}

/**
 * Check if participants are populated (objects vs IDs)
 *
 * @param participants - Raw participants data
 * @returns True if participants are populated objects
 */
export function areParticipantsPopulated(participants: any[]): boolean {
  if (!participants || participants.length === 0) {
    return false
  }

  const firstItem = participants[0]
  return typeof firstItem === 'object' && (firstItem.id || firstItem._id)
}

/**
 * Get other participant in a private conversation
 *
 * @param participants - Array of participants
 * @param currentUserId - Current user's ID
 * @returns The other user, or null if not found
 */
export function getOtherParticipant(
  participants: IUser[],
  currentUserId: string
): IUser | null {
  return participants.find(p => p.id !== currentUserId) || null
}

/**
 * Create display name for conversation
 *
 * For private chats: other user's name
 * For group chats: comma-separated names or custom group name
 *
 * @param conversation - Conversation object
 * @param currentUserId - Current user's ID
 * @returns Display name
 */
export function getConversationDisplayName(
  conversation: {
    type: 'private' | 'group'
    name?: string
    participants: IUser[]
  },
  currentUserId: string
): string {
  // Group chat with custom name
  if (conversation.type === 'group' && conversation.name) {
    return conversation.name
  }

  // Private chat: show other user's name
  if (conversation.type === 'private') {
    const otherUser = getOtherParticipant(conversation.participants, currentUserId)
    return otherUser?.name || 'Unknown User'
  }

  // Group chat without name: show participant names
  const names = conversation.participants
    .filter(p => p.id !== currentUserId)
    .map(p => p.name)
    .filter(Boolean)

  if (names.length === 0) {
    return 'Group Chat'
  }

  if (names.length <= 3) {
    return names.join(', ')
  }

  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`
}
