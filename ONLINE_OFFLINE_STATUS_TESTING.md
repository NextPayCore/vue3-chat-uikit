# Online/Offline Status Testing Guide

## Current Implementation

### Socket Events Listened
The app listens to multiple event name formats to ensure compatibility:

1. `user:online` / `user:offline` (with colon)
2. `user_online` / `user_offline` (with underscore)
3. `online` / `offline` (simple format)

### Code Flow

```
Socket Backend → useSocket.ts → App.vue → onlineUsers Set → isOtherUserOnline computed → UI
```

### Implementation Details

#### 1. State Management (`App.vue`)
```typescript
// State: Track online users
const onlineUsers = ref<Set<string>>(new Set())

// Computed: Check if other user is online
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

#### 2. Socket Event Handlers (`App.vue`)
```typescript
onUserOnline: (userId: string) => {
  console.log('🟢 User online:', userId)
  onlineUsers.value.add(userId)  // Add to Set
},

onUserOffline: (userId: string) => {
  console.log('⚪ User offline:', userId)
  onlineUsers.value.delete(userId)  // Remove from Set
}
```

#### 3. UI Display (Template)
```vue
<p v-else class="online-status">
  {{ isOtherUserOnline ? '🟢 Online' : '⚪ Offline' }}
</p>
```

---

## Testing Checklist

### 1. Check if Events Are Being Received

**Open Browser Console** and look for logs:

```javascript
// When user comes online
🟢 Received user:online event: 68f5d532334e1cfa50f451a7
🟢 User online: 68f5d532334e1cfa50f451a7

// When user goes offline
⚪ Received user:offline event: 68f5d532334e1cfa50f451a7
⚪ User offline: 68f5d532334e1cfa50f451a7
```

**If you DON'T see these logs:**
- Socket events are not being emitted by backend
- Event name might be different
- Need to check backend documentation

---

### 2. Manual Testing in Console

Open browser DevTools console and test manually:

```javascript
// Check current online users
console.log('Online users:', window.$vm.onlineUsers.value)

// Manually add a user as online
window.$vm.onlineUsers.value.add('68f5d532334e1cfa50f451a7')

// Check if user is now shown as online
console.log('Is online?', window.$vm.isOtherUserOnline.value)

// Manually remove user
window.$vm.onlineUsers.value.delete('68f5d532334e1cfa50f451a7')
```

---

### 3. Check Backend Events

In browser console, listen to ALL socket events to see what backend actually emits:

```javascript
// Get socket instance
const socket = window.$vm.socket.value

// Log ALL incoming events
const originalOn = socket.on.bind(socket)
socket.onAny((eventName, ...args) => {
  console.log('📡 Socket event:', eventName, args)
})
```

**Look for events related to presence/status:**
- `user:online`, `user:offline`
- `user_online`, `user_offline`
- `online`, `offline`
- `presence:online`, `presence:offline`
- `status:online`, `status:offline`
- Custom event names

---

### 4. Test Scenarios

#### Scenario A: User Opens Chat
**Expected:**
1. Socket connects
2. Backend emits list of online users
3. `onUserOnline` called for each online user
4. UI shows online status

**Test:**
```javascript
// After login, check online users
console.log('Online users:', window.$vm.onlineUsers.value)
// Should contain IDs of online users
```

#### Scenario B: Friend Comes Online
**Expected:**
1. Backend emits `user:online` event
2. userId added to onlineUsers Set
3. UI updates to show green "🟢 Online"

**Test:**
1. Open chat with a friend (currently offline)
2. Have friend login on another device
3. Check if status changes to online

#### Scenario C: Friend Goes Offline
**Expected:**
1. Backend emits `user:offline` event
2. userId removed from onlineUsers Set
3. UI updates to show "⚪ Offline"

**Test:**
1. Open chat with online friend
2. Have friend close browser/logout
3. Check if status changes to offline

#### Scenario D: Refresh Page
**Expected:**
1. onlineUsers cleared
2. Socket reconnects
3. Backend re-sends online users list
4. Status restored

---

## Debugging

### Check if Backend Supports Presence

**Option 1: Check Socket.IO Admin UI**
If backend has Socket.IO admin panel, you can see:
- Connected users
- User presence status
- Emitted events

**Option 2: Ask Backend Team**
Questions to ask:
1. Does backend emit online/offline events?
2. What are the event names?
3. Is it per-user or per-connection?
4. Is there an initial "online users" event?

**Option 3: Network Tab**
1. Open DevTools → Network → WS (WebSocket)
2. Click on socket connection
3. Go to "Messages" tab
4. Look for presence-related messages

---

## Common Issues

### Issue 1: Events Not Received
**Symptoms:**
- No console logs for user:online/offline
- Status always shows offline

**Solutions:**
1. Check if backend emits these events
2. Try different event names
3. Check socket connection is established
4. Check if you're in the right "room"

### Issue 2: Wrong Event Name
**Symptoms:**
- Logs show events but different name

**Solution:**
Add listener for the correct event name:
```typescript
socket.value.on('correct_event_name', (userId: string) => {
  console.log('✅ User status changed:', userId)
  events?.onUserOnline?.(userId)
})
```

### Issue 3: Initial State Missing
**Symptoms:**
- Status works after friend logs in/out
- But wrong on initial load

**Solution:**
Backend should emit initial online users list after connect:
```typescript
onConnect: () => {
  // Request initial online users
  socket.value.emit('get_online_users')
}

// Listen for response
socket.value.on('online_users', (userIds: string[]) => {
  userIds.forEach(id => onlineUsers.value.add(id))
})
```

### Issue 4: UserIds Don't Match
**Symptoms:**
- Events received but status not updating
- Different userId formats

**Solution:**
Check userId format in events vs participants:
```javascript
// In console
console.log('Event userId:', userId)
console.log('Participant ID:', activeConversation.value.participants[0].id)
// Compare formats
```

---

## Enable Vue DevTools

To inspect reactive state:

1. Install Vue DevTools browser extension
2. Open DevTools → Vue tab
3. Select root component
4. Inspect `onlineUsers` and `isOtherUserOnline`

---

## Quick Debug Script

Add to browser console:

```javascript
// Debug helper
window.debugPresence = {
  // Check state
  getOnlineUsers: () => {
    return Array.from(window.$vm.onlineUsers.value)
  },
  
  // Check if specific user is online
  isOnline: (userId) => {
    return window.$vm.onlineUsers.value.has(userId)
  },
  
  // Check current conversation
  getCurrentChat: () => {
    const conv = window.$vm.activeConversation.value
    if (!conv) return 'No active conversation'
    
    const other = conv.participants.find(p => p.id !== window.$vm.authUser.value?.id)
    return {
      conversationType: conv.type,
      otherUserId: other?.id,
      otherUserName: other?.name,
      isOnline: window.$vm.onlineUsers.value.has(other?.id)
    }
  },
  
  // Simulate online event
  simulateOnline: (userId) => {
    window.$vm.onlineUsers.value.add(userId)
    console.log('✅ Simulated online:', userId)
  },
  
  // Simulate offline event
  simulateOffline: (userId) => {
    window.$vm.onlineUsers.value.delete(userId)
    console.log('✅ Simulated offline:', userId)
  },
  
  // Listen to all socket events
  listenAll: () => {
    const socket = window.$vm.socket.value
    if (!socket) return 'Socket not connected'
    
    socket.onAny((event, ...args) => {
      console.log('📡 Socket:', event, args)
    })
    
    return 'Listening to all socket events'
  }
}

console.log('Debug helper loaded. Use window.debugPresence')
```

**Usage:**
```javascript
// Check online users
debugPresence.getOnlineUsers()
// ['68f5d532334e1cfa50f451a7', '68f5d533334e1cfa50f451a8']

// Check specific user
debugPresence.isOnline('68f5d532334e1cfa50f451a7')
// true

// Check current conversation
debugPresence.getCurrentChat()
// {conversationType: 'private', otherUserId: '...', isOnline: true}

// Simulate events for testing UI
debugPresence.simulateOnline('68f5d532334e1cfa50f451a7')
debugPresence.simulateOffline('68f5d532334e1cfa50f451a7')

// Listen to all socket events
debugPresence.listenAll()
```

---

## Expected Console Logs

### On Socket Connect
```
🔌 Connecting to socket server: https://be.hoanganhtu.online
Socket connected: ABC123XYZ
✅ Socket connected successfully
```

### When User Comes Online
```
🟢 Received user:online event: 68f5d532334e1cfa50f451a7
🟢 User online: 68f5d532334e1cfa50f451a7
```

### When User Goes Offline
```
⚪ Received user:offline event: 68f5d532334e1cfa50f451a7
⚪ User offline: 68f5d532334e1cfa50f451a7
```

---

## Backend Requirements

For this feature to work, backend MUST:

1. ✅ Emit `user:online` (or similar) when user connects
2. ✅ Emit `user:offline` (or similar) when user disconnects
3. ✅ Send initial online users list after socket connects
4. ✅ Track user presence per userId (not per socket connection)
5. ✅ Handle multiple connections per user

**Recommended Backend Implementation:**

```javascript
// Server-side (Node.js + Socket.IO)
io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId
  
  // Add to online users
  onlineUsers.add(userId)
  
  // Broadcast to all connected clients
  io.emit('user:online', userId)
  
  // Send initial online users to this client
  socket.emit('online_users', Array.from(onlineUsers))
  
  socket.on('disconnect', () => {
    // Check if user has other connections
    const hasOtherConnections = Array.from(io.sockets.sockets.values())
      .some(s => s.handshake.auth.userId === userId)
    
    if (!hasOtherConnections) {
      onlineUsers.delete(userId)
      io.emit('user:offline', userId)
    }
  })
})
```

---

## Next Steps

1. ✅ Check browser console for presence events
2. ✅ Use debug helper to inspect state
3. ✅ Test with 2 browser windows/devices
4. ⏳ Confirm backend emits presence events
5. ⏳ Add "Last seen" timestamp if needed
6. ⏳ Add bulk online status for conversation list

---

## Related Files

- `src/App.vue` - State management and event handlers
- `src/composables/useSocket.ts` - Socket event listeners
- `SOCKET_MESSAGE_PARSER.md` - Socket message normalization
- `CLIENT_SIDE_MESSAGE_HANDLING.md` - Client-side processing
