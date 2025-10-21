/**
 * Message Parser Utilities
 *
 * Utilities for parsing and resolving message references,
 * particularly handling backend inconsistencies with replyTo field.
 */

import type { IChatMessage } from '../composables/useMessages'

/**
 * Parse replyTo string and extract ObjectId
 *
 * Handles multiple formats:
 * 1. Plain ObjectId: "68f608c2e981c55e7c302c9c"
 * 2. MongoDB constructor: "new ObjectId('68f608c2e981c55e7c302c9c')"
 * 3. Full MongoDB document toString: "{\n  _id: new ObjectId('68f608c2e981c55e7c302c9c'), ..."
 *
 * @param replyToString - The replyTo string from backend
 * @returns The extracted ObjectId or null if parsing fails
 */
export function parseReplyToId(replyToString: string | null | undefined): string | null {
  if (!replyToString || typeof replyToString !== 'string') {
    return null
  }

  // Case 1: Plain ObjectId string (24 hex characters)
  if (replyToString.match(/^[a-f0-9]{24}$/i)) {
    return replyToString
  }

  // Case 2: MongoDB ObjectId constructor format
  // e.g., "new ObjectId('68f608c2e981c55e7c302c9c')"
  const objectIdMatch = replyToString.match(/ObjectId\('([a-f0-9]{24})'\)/i)
  if (objectIdMatch && objectIdMatch[1]) {
    return objectIdMatch[1]
  }

  // Case 3: MongoDB document toString with _id field
  // e.g., "{\n  _id: new ObjectId('68f608c2e981c55e7c302c9c'),\n  ..."
  const idFieldMatch = replyToString.match(/_id:\s*new ObjectId\('([a-f0-9]{24})'\)/i)
  if (idFieldMatch && idFieldMatch[1]) {
    return idFieldMatch[1]
  }

  // No valid ID found
  return null
}

/**
 * Resolve replyTo references in a batch of messages
 *
 * Processes messages and populates replyToMessage field by finding
 * the referenced message in the same batch.
 *
 * @param messages - Array of messages to process
 * @param options - Configuration options
 * @returns Processed messages with resolved references
 */
export function resolveReplyToReferences(
  messages: IChatMessage[],
  options: {
    verbose?: boolean
    warnOnMissing?: boolean
  } = {}
): IChatMessage[] {
  const { verbose = true, warnOnMissing = true } = options

  return messages.map(msg => {
    // Check if backend sent replyMessage field (new format)
    if ((msg as any).replyMessage && !msg.replyToMessage) {
      msg.replyToMessage = (msg as any).replyMessage
      if (verbose) {
        console.log(`✅ Used replyMessage field for message ${msg.id}`)
      }
      return msg
    }

    // Skip if already has replyToMessage or no replyTo
    if (!msg.replyTo || msg.replyToMessage) {
      return msg
    }

    // Only process string replyTo
    if (typeof msg.replyTo !== 'string') {
      return msg
    }

    // Parse the replyTo string to get the ID
    const replyToId = parseReplyToId(msg.replyTo)

    if (replyToId) {
      // Find the referenced message in the same batch
      const replyToMsg = messages.find(m => m.id === replyToId)

      if (replyToMsg) {
        msg.replyToMessage = replyToMsg
        if (verbose) {
          console.log(`✅ Resolved replyTo for message ${msg.id} -> ${replyToId}`)
        }
      } else if (warnOnMissing) {
        console.warn(`⚠️ Reply message ${replyToId} not found in current batch`)
      }
    } else if (warnOnMissing) {
      console.warn(`⚠️ Could not parse replyTo ID from: ${msg.replyTo.substring(0, 100)}...`)
    }

    return msg
  })
}

/**
 * Check if a string looks like a MongoDB ObjectId
 *
 * @param str - String to check
 * @returns True if it looks like an ObjectId
 */
export function isObjectIdString(str: string): boolean {
  return /^[a-f0-9]{24}$/i.test(str)
}

/**
 * Extract all ObjectIds from a string
 * Useful for debugging or parsing complex strings
 *
 * @param str - String to extract from
 * @returns Array of found ObjectIds
 */
export function extractAllObjectIds(str: string): string[] {
  const regex = /ObjectId\('([a-f0-9]{24})'\)/gi
  const matches: string[] = []
  let match

  while ((match = regex.exec(str)) !== null) {
    if (match[1]) {
      matches.push(match[1])
    }
  }

  return matches
}
