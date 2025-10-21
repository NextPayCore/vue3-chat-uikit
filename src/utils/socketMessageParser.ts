/**
 * Socket Message Parser Utilities
 *
 * Parse and normalize message data received from Socket.IO events.
 * Handles inconsistent data formats from backend (sender as object vs senderId string).
 */

import type { IMessage } from '../interfaces/message.interface'
import type { IChatMessage } from '../interfaces/message.interface'
import { parseReplyToId } from './messageParser'

/**
 * Parse sender field from socket message
 *
 * Handles two formats:
 * 1. sender as full object: {id, name, avatarUrl, email, isOnline}
 * 2. senderId as string: "68f5d531334e1cfa50f451a6"
 *
 * @param message - Raw message from socket
 * @returns Normalized sender object
 */
export function parseSenderFromSocketMessage(message: any): {
  id: string
  name: string
  avatarUrl: string
  email: string
  isOnline: boolean
} {
  // Case 1: sender is already an object
  if (message.sender && typeof message.sender === 'object') {
    return {
      id: message.sender.id || message.sender._id,
      name: message.sender.name || message.sender.username || 'Unknown',
      avatarUrl: message.sender.avatarUrl || message.sender.avatar || '',
      email: message.sender.email || '',
      isOnline: message.sender.isOnline || false
    }
  }

  // Case 2: only senderId string exists
  if (message.senderId || message.sender_id) {
    const senderId = message.senderId || message.sender_id
    return {
      id: senderId,
      name: message.senderName || senderId.substring(0, 8) + '...',
      avatarUrl: message.senderAvatar || '',
      email: '',
      isOnline: false
    }
  }

  // Fallback: unknown sender
  console.warn('⚠️ Cannot parse sender from message:', message)
  return {
    id: 'unknown',
    name: 'Unknown User',
    avatarUrl: '',
    email: '',
    isOnline: false
  }
}

/**
 * Normalize socket message to IMessage format
 *
 * Converts raw socket message to frontend IMessage interface.
 * Handles sender parsing, replyTo parsing, and field normalization.
 *
 * @param socketMessage - Raw message from socket event
 * @param currentUserId - Current user's ID for role determination
 * @returns Normalized IMessage object
 */
export function normalizeSocketMessage(
  socketMessage: any,
  currentUserId?: string
): IMessage {
  const sender = parseSenderFromSocketMessage(socketMessage)
  const isFromCurrentUser = currentUserId ? sender.id === currentUserId : false

  // Parse replyTo if exists
  let replyToMessage: IMessage | undefined
  if (socketMessage.replyTo) {
    if (typeof socketMessage.replyTo === 'string') {
      // Backend sent replyTo as string ID - will need to be resolved later
      const replyToId = parseReplyToId(socketMessage.replyTo)
      // Check both replyToMessage and replyMessage fields
      if (replyToId && (socketMessage.replyToMessage || socketMessage.replyMessage)) {
        // If replyToMessage/replyMessage is populated, use it
        replyToMessage = normalizeSocketMessage(
          socketMessage.replyToMessage || socketMessage.replyMessage,
          currentUserId
        )
      }
    } else if (typeof socketMessage.replyTo === 'object') {
      // Backend sent full replyTo message object
      replyToMessage = normalizeSocketMessage(socketMessage.replyTo, currentUserId)
    }
  } else if (socketMessage.replyMessage) {
    // Backend only sent replyMessage field (without replyTo)
    replyToMessage = normalizeSocketMessage(socketMessage.replyMessage, currentUserId)
  }

  return {
    id: socketMessage.id || socketMessage._id,
    content: socketMessage.content || '',
    contentText: socketMessage.content || '',
    sender: {
      id: sender.id,
      name: sender.name,
      avatarUrl: sender.avatarUrl,
      isOnline: sender.isOnline
    },
    status: socketMessage.status || 'delivered',
    role: isFromCurrentUser ? 'user' : 'assistant',
    timestamp: new Date(socketMessage.createdAt || Date.now()),
    type: socketMessage.type || 'text',
    createdAt: new Date(socketMessage.createdAt || Date.now()),
    updatedAt: new Date(socketMessage.updatedAt || socketMessage.createdAt || Date.now()),
    fileUrl: socketMessage.fileUrl,
    fileName: socketMessage.fileName,
    metadata: {
      isEdited: socketMessage.isEdited || false,
      isDeleted: socketMessage.isDeleted || false,
      conversationId: socketMessage.conversationId // IMPORTANT: Include conversationId
    },
    ...(replyToMessage && { replyTo: replyToMessage })
  }
}

/**
 * Normalize socket conversation data
 *
 * Handles participants parsing similar to conversationParser.
 *
 * @param socketConversation - Raw conversation from socket event
 * @returns Normalized conversation object
 */
export function normalizeSocketConversation(socketConversation: any) {
  // Parse participants
  let participants = []
  if (socketConversation.participants && socketConversation.participants.length > 0) {
    participants = socketConversation.participants.map((p: any) => {
      if (typeof p === 'string') {
        // Participant is just an ID
        return {
          id: p,
          name: p.substring(0, 8) + '...',
          avatarUrl: '',
          email: '',
          isOnline: false
        }
      } else {
        // Participant is an object
        return {
          id: p.id || p._id,
          name: p.name || p.username || 'Unknown',
          avatarUrl: p.avatarUrl || p.avatar || '',
          email: p.email || '',
          isOnline: p.isOnline || false
        }
      }
    })
  }

  return {
    _id: socketConversation.id || socketConversation._id,
    type: socketConversation.type || 'private',
    name: socketConversation.name,
    description: socketConversation.description,
    avatar: socketConversation.avatar,
    participants,
    lastMessage: socketConversation.lastMessage
      ? normalizeSocketMessage(socketConversation.lastMessage)
      : undefined,
    lastMessageAt: socketConversation.lastMessageAt
      ? new Date(socketConversation.lastMessageAt)
      : new Date(),
    unreadCount: socketConversation.unreadCount || 0,
    createdAt: new Date(socketConversation.createdAt || Date.now()),
    updatedAt: new Date(socketConversation.updatedAt || Date.now()),
    metadata: {
      isActive: socketConversation.isActive ?? true,
      isMuted: socketConversation.isMuted || false,
      isPinned: socketConversation.isPinned || false
    }
  }
}

/**
 * Convert IMessage to IChatMessage format
 *
 * Converts normalized socket message to backend IChatMessage format
 * for use with useMessages composable.
 *
 * @param message - Normalized IMessage from socket
 * @param conversationId - Conversation ID
 * @returns IChatMessage format
 */
export function convertToIChatMessage(
  message: IMessage,
  conversationId: string
): any {
  return {
    id: message.id,
    conversationId,
    sender: {
      id: message.sender.id,
      name: message.sender.name,
      email: message.sender.email || '',
      avatar: message.sender.avatarUrl || ''
    },
    content: message.content,
    type: message.type || 'text',
    fileUrl: message.fileUrl,
    fileName: message.fileName,
    readBy: [], // Will be updated later
    replyTo: message.replyTo?.id,
    replyToMessage: message.replyTo ? convertToIChatMessage(message.replyTo, conversationId) : undefined,
    isEdited: message.metadata?.isEdited || false,
    isDeleted: message.metadata?.isDeleted || false,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  }
}

