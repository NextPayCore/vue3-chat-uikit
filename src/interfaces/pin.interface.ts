import type { IMessage } from './message.interface'

/**
 * DTO for pinning a message
 */
export interface IPinMessageDto {
  messageId: string
}

/**
 * DTO for unpinning a message
 */
export interface IUnpinMessageDto {
  messageId: string
}

/**
 * DTO for reordering a pinned message
 */
export interface IReorderPinnedMessageDto {
  messageId: string
  newOrder: number
}

/**
 * Pinned message details
 */
export interface IPinnedMessage {
  id: string                    // Pin ID
  message: IMessage            // Full message details
  pinnedBy: string             // User ID who pinned
  order: number                // Order position (0-4)
  pinnedAt: Date               // When pinned
}

/**
 * Response containing all pinned messages in a conversation
 */
export interface IConversationPinnedMessages {
  conversationId: string
  pinnedMessages: IPinnedMessage[]
  totalPinned: number
}

/**
 * Socket event data when a message is pinned
 */
export interface IMessagePinnedEvent {
  message: IMessage
  pinnedBy: string
  conversationId: string
}

/**
 * Socket event data when a message is unpinned
 */
export interface IMessageUnpinnedEvent {
  message: IMessage
  unpinnedBy: string
  conversationId: string
}

/**
 * Socket event data when pinned messages are reordered
 */
export interface IPinnedMessageReorderedEvent {
  messageId: string
  newOrder: number
  reorderedBy: string
  conversationId: string
}
