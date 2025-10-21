# Online/Offline Status Feature Summary

## ✅ Implementation Complete

### Features Implemented

1. **Real-time Presence Tracking**
   - Track online/offline status of users
   - Display status in conversation header
   - Update status immediately when users connect/disconnect

2. **Multiple Event Format Support**
   - `user:online` / `user:offline` (with colon)
   - `user_online` / `user_offline` (with underscore)  
   - `online` / `offline` (simple format)
   - Supports multiple backend implementations

3. **Initial Online Users List**
   - Request online users on socket connect
   - Listen for `online_users` or `users_online` events
   - Initialize state with current online users

4. **State Management**
   - Uses `Set<string>` for efficient lookups
   - Reactive state with Vue 3 Composition API
   - Auto-updates UI when status changes

---

## Code Implementation

### 1. State & Computed (`App.vue`)

```typescript
// State: Track online users
const onlineUsers = ref<Set<string>>(new Set())

// Computed: Check if other user in current conversation is online
const isOtherUserOnline = computed(() => {
  if (!activeConversation.value || activeConversation.value.type === 'group') {
    return false
  }

  const otherParticipant = activeConversation.value.participants.find(
    p => p.id !== authUser.value?.id
  )

  return otherParticipant ? onlineUsers.value.has(otherParticipant.id) : false
})
```

### 2. Socket Event Handlers (`App.vue`)

```typescript
onConnect: () => {
  // Request initial online users list
  if (socket.value?.connected) {
    socket.value.emit('get_online_users')
  }
},

onUserOnline: (userId: string) => {
  console.log('🟢 User online:', userId)
  onlineUsers.value.add(userId)
},

onUserOffline: (userId: string) => {
  console.log('⚪ User offline:', userId)
  onlineUsers.value.delete(userId)
},

onOnlineUsers: (userIds: string[]) => {
  console.log('👥 Initial online users received:', userIds.length, 'users')
  onlineUsers.value.clear()
  userIds.forEach(userId => onlineUsers.value.add(userId))
}
```

### 3. Socket Event Listeners (`useSocket.ts`)

```typescript
// Listen for multiple event name formats
socket.value.on('user:online', (userId: string) => {
  console.log('🟢 Received user:online event:', userId)
  events?.onUserOnline?.(userId)
})

socket.value.on('user_online', (userId: string) => {
  console.log('🟢 Received user_online event:', userId)
  events?.onUserOnline?.(userId)
})

socket.value.on('online', (userId: string) => {
  console.log('🟢 Received online event:', userId)
  events?.onUserOnline?.(userId)
})

// Same for offline events...

// Initial online users list
socket.value.on('online_users', (userIds: string[]) => {
  console.log('👥 Received online_users list:', userIds)
  events?.onOnlineUsers?.(userIds)
})
```

### 4. UI Display (Template)

```vue
<div class="conversation-details">
  <h3>{{ conversationName }}</h3>
  
  <!-- Typing indicator (priority) -->
  <p v-if="typingUsers.length > 0" class="typing-indicator">
    {{ typingUsers.join(', ') }} {{ typingUsers.length === 1 ? 'is' : 'are' }} typing...
  </p>
  
  <!-- Group members count -->
  <p v-else-if="activeConversation.type === 'group'">
    {{ activeConversation.participants.length }} members
  </p>
  
  <!-- Online/Offline status for private chats -->
  <p v-else class="online-status">
    {{ isOtherUserOnline ? '🟢 Online' : '⚪ Offline' }}
  </p>
</div>
```

---

## How It Works

### Connection Flow

```
1. User logs in
   ↓
2. Socket connects to backend
   ↓
3. onConnect() fires
   ↓
4. Emit 'get_online_users' request
   ↓
5. Backend responds with 'online_users' event
   ↓
6. onOnlineUsers() handler populates Set
   ↓
7. UI shows online/offline status
```

### Status Update Flow

```
User A comes online
   ↓
Backend emits 'user:online' with userId
   ↓
All connected clients receive event
   ↓
onUserOnline() adds userId to Set
   ↓
isOtherUserOnline computed updates
   ↓
UI shows 🟢 Online
```

---

## Event Names Supported

| Event Type | Variants | Description |
|------------|----------|-------------|
| User Online | `user:online`<br>`user_online`<br>`online` | When user connects |
| User Offline | `user:offline`<br>`user_offline`<br>`offline` | When user disconnects |
| Online List | `online_users`<br>`users_online` | Initial list of online users |

---

## Testing

### Check if Feature Works

1. **Open Browser Console**
   ```
   Should see logs:
   ✅ Socket connected successfully
   📡 Requesting online users list...
   👥 Initial online users received: X users
   ```

2. **Open Chat with Friend**
   ```
   Status should show:
   🟢 Online (if friend is online)
   ⚪ Offline (if friend is offline)
   ```

3. **Have Friend Login/Logout**
   ```
   Should see status change in real-time:
   🟢 Received user:online event: <userId>
   🟢 User online: <userId>
   ```

### Debug Commands

```javascript
// In browser console

// Check online users
console.log('Online users:', Array.from(window.$vm.onlineUsers.value))

// Check specific user
const userId = '68f5d532334e1cfa50f451a7'
console.log('Is online?', window.$vm.onlineUsers.value.has(userId))

// Check current conversation status
console.log('Other user online?', window.$vm.isOtherUserOnline.value)

// Manually test UI
window.$vm.onlineUsers.value.add('68f5d532334e1cfa50f451a7')
window.$vm.onlineUsers.value.delete('68f5d532334e1cfa50f451a7')
```

---

## Backend Requirements

For this feature to work properly, backend MUST implement:

### 1. Track User Connections
```javascript
const onlineUsers = new Map() // userId -> Set<socketId>

io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId
  
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set())
  }
  
  onlineUsers.get(userId).add(socket.id)
})
```

### 2. Emit Online Event
```javascript
// When first connection from user
if (onlineUsers.get(userId).size === 1) {
  io.emit('user:online', userId)
}
```

### 3. Emit Offline Event
```javascript
socket.on('disconnect', () => {
  onlineUsers.get(userId).delete(socket.id)
  
  // When last connection from user disconnects
  if (onlineUsers.get(userId).size === 0) {
    onlineUsers.delete(userId)
    io.emit('user:offline', userId)
  }
})
```

### 4. Send Initial Online List
```javascript
socket.on('get_online_users', () => {
  const userIds = Array.from(onlineUsers.keys())
  socket.emit('online_users', userIds)
})
```

---

## Benefits

### User Experience
- ✅ **Real-time status** - No need to refresh
- ✅ **Instant updates** - See when friends come online
- ✅ **Visual feedback** - 🟢 Online / ⚪ Offline icons
- ✅ **No polling** - Efficient Socket.IO events

### Performance
- ✅ **Efficient data structure** - Set for O(1) lookups
- ✅ **Minimal state** - Only stores user IDs
- ✅ **Reactive updates** - Vue handles UI updates
- ✅ **No API calls** - All via socket events

### Compatibility
- ✅ **Multiple event formats** - Works with different backends
- ✅ **Graceful fallback** - Shows offline if events not received
- ✅ **Private chats only** - Doesn't show for groups
- ✅ **Non-blocking** - Feature works independently

---

## Known Limitations

1. **Group Chats**: Currently only shows online status for private (1-on-1) chats
2. **Backend Dependent**: Requires backend to emit presence events
3. **Initial State**: Depends on backend sending online users list
4. **Multi-Device**: Assumes backend handles multiple connections per user

---

## Future Enhancements

### 1. Last Seen Timestamp
```typescript
interface UserPresence {
  userId: string
  isOnline: boolean
  lastSeen?: Date
}

const userPresence = ref<Map<string, UserPresence>>(new Map())
```

### 2. Typing + Online Status
```vue
<p v-if="typingUsers.length > 0" class="typing-indicator">
  {{ typingUsers.join(', ') }} typing...
</p>
<p v-else-if="isOtherUserOnline" class="online-status">
  🟢 Online
</p>
<p v-else-if="lastSeen" class="last-seen">
  Last seen {{ formatLastSeen(lastSeen) }}
</p>
```

### 3. Bulk Status for Conversation List
```typescript
// Show online indicator on each conversation
const conversationsWithStatus = computed(() => {
  return conversations.value.map(conv => ({
    ...conv,
    hasOnlineUsers: conv.participants.some(p => onlineUsers.value.has(p.id))
  }))
})
```

### 4. Group Member Status
```typescript
// Show online count for groups
const onlineMembersCount = computed(() => {
  if (!activeConversation.value || activeConversation.value.type !== 'group') {
    return 0
  }
  
  return activeConversation.value.participants.filter(p =>
    onlineUsers.value.has(p.id)
  ).length
})
```

---

## Troubleshooting

### Status Always Shows Offline

**Possible Causes:**
1. Backend not emitting events
2. Different event name format
3. UserId format mismatch
4. Not in same socket room

**Solutions:**
1. Check console for event logs
2. Try all event name variants
3. Compare userId formats in events vs participants
4. Ensure backend emits to all connected clients

### Status Not Updating

**Possible Causes:**
1. Socket disconnected
2. Event listeners not set up
3. State not reactive

**Solutions:**
1. Check socket connection status
2. Verify event handlers are called (check logs)
3. Ensure using `.value` for refs

### Initial State Wrong

**Possible Causes:**
1. Backend not sending initial list
2. Request not sent on connect
3. Event name mismatch

**Solutions:**
1. Check if `get_online_users` is emitted
2. Verify backend responds with list
3. Try alternative event names

---

## Files Modified

1. ✅ `src/App.vue` - State management, event handlers, UI
2. ✅ `src/composables/useSocket.ts` - Socket event listeners
3. ✅ `ONLINE_OFFLINE_STATUS_TESTING.md` - Testing guide
4. ✅ `ONLINE_OFFLINE_STATUS_SUMMARY.md` - This file

---

## Console Logs to Expect

### On Socket Connect
```
✅ Socket connected successfully
📡 Requesting online users list...
```

### On Receiving Online Users
```
👥 Received online_users list: ['68f5d532...', '68f5d533...']
👥 Initial online users received: 2 users
✅ Online users initialized: ['68f5d532...', '68f5d533...']
```

### On User Status Change
```
🟢 Received user:online event: 68f5d532334e1cfa50f451a7
🟢 User online: 68f5d532334e1cfa50f451a7

⚪ Received user:offline event: 68f5d532334e1cfa50f451a7
⚪ User offline: 68f5d532334e1cfa50f451a7
```

---

## Related Documentation

- `SOCKET_MESSAGE_PARSER.md` - Socket message normalization
- `CLIENT_SIDE_MESSAGE_HANDLING.md` - Client-side optimizations
- `SOCKET_OPTIMIZATION_SUMMARY.md` - Performance improvements
- `ONLINE_OFFLINE_STATUS_TESTING.md` - Detailed testing guide
