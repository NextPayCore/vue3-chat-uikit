# 🔍 Socket.IO Authentication Debug Guide

## ✅ Fixed Issues

### 1. Frontend Token Configuration
**Before (Wrong):**
```typescript
options: {
  handshake: {
    auth: {
      token: localStorage.getItem('auth_token')
    }
  }
}
```

**After (Correct):**
```typescript
options: {
  auth: {
    token: localStorage.getItem('auth_token')
  }
}
```

### 2. Backend Token Verification
Backend code should look like this:

```typescript
// NestJS Socket Gateway
@WebSocketGateway({
  cors: { origin: '*', credentials: true }
})
export class ChatGateway implements OnGatewayConnection {
  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // ✅ Correct way to get token
      const token = client.handshake.auth.token;
      
      if (!token) {
        console.log('❌ No token provided');
        client.disconnect();
        return;
      }

      // Verify token
      const payload = await this.jwtService.verifyAsync(token);
      
      console.log('✅ User authenticated:', {
        userId: payload.sub,
        email: payload.email
      });
      
      // Store user info in socket
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      
      // Send error to client
      client.emit('error', {
        message: 'Authentication failed',
        detail: error.message
      });
      
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }
}
```

---

## 🧪 Testing Steps

### Step 1: Check Token in Browser

Open DevTools Console:
```javascript
// Get token
const token = localStorage.getItem('auth_token')
console.log('Token:', token)

// Decode JWT (without verification)
if (token) {
  const parts = token.split('.')
  const payload = JSON.parse(atob(parts[1]))
  console.log('Token payload:', payload)
  console.log('Expires:', new Date(payload.exp * 1000))
  console.log('Is expired?', Date.now() > payload.exp * 1000)
}
```

### Step 2: Check Socket Connection

```javascript
// In browser console
// Watch for socket events
window.addEventListener('socket:connect', (e) => {
  console.log('✅ Socket connected', e.detail)
})

window.addEventListener('socket:error', (e) => {
  console.error('❌ Socket error', e.detail)
})
```

### Step 3: Monitor Network Tab

1. Open DevTools → Network tab
2. Filter by `WS` (WebSocket)
3. Look for connection to `localhost:1200`
4. Check Headers → Request Headers → Should see auth data

Expected headers:
```
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: ...
Sec-WebSocket-Version: 13
```

Expected query/auth params:
```
auth: {
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Step 4: Check Backend Logs

Backend should log:
```
✅ Socket.IO server started on port 1200
✅ User authenticated: { userId: '68f3073ae...', email: 'user@example.com' }
✅ Socket connected: <socket-id>
```

If you see:
```
❌ No token provided
❌ Authentication failed: JsonWebTokenError: secret or public key must be provided
❌ Authentication failed: jwt malformed
❌ Authentication failed: jwt expired
```

Then there's an issue with:
1. Token not being sent
2. Backend JWT_SECRET missing
3. Token is invalid/malformed
4. Token has expired

---

## 🔧 Common Issues & Solutions

### Issue 1: Token Not Being Sent

**Symptom:**
```
❌ No token provided
```

**Solution:**
```typescript
// Check in App.vue before connecting
const token = localStorage.getItem('auth_token')
console.log('Token before connect:', token ? '✅ Found' : '❌ Missing')

if (!token) {
  console.error('No token in localStorage!')
  // Show login modal
  showLoginModal.value = true
  return
}
```

### Issue 2: Token Format Wrong

**Symptom:**
```
❌ Authentication failed: jwt malformed
```

**Solution:**
```javascript
// Token should have 3 parts separated by dots
const token = localStorage.getItem('auth_token')
const parts = token?.split('.')

if (parts?.length !== 3) {
  console.error('Invalid JWT format! Should have 3 parts.')
  console.log('Parts:', parts?.length)
  // Clear bad token
  localStorage.removeItem('auth_token')
  // Force re-login
}
```

### Issue 3: Token Expired

**Symptom:**
```
❌ Authentication failed: jwt expired
```

**Solution:**
```typescript
// Check expiration before connecting
const checkTokenExpiration = () => {
  const token = localStorage.getItem('auth_token')
  if (!token) return false
  
  try {
    const parts = token.split('.')
    const payload = JSON.parse(atob(parts[1]))
    const isExpired = Date.now() > payload.exp * 1000
    
    if (isExpired) {
      console.warn('Token expired! Please login again.')
      localStorage.removeItem('auth_token')
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error checking token:', error)
    return false
  }
}

// Use before connecting
if (!checkTokenExpiration()) {
  showLoginModal.value = true
  return
}
```

### Issue 4: Backend Missing JWT_SECRET

**Symptom:**
```
❌ Authentication failed: secret or public key must be provided
```

**Solution:**
Backend needs `.env` file:
```env
JWT_SECRET=your-super-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=24h
```

Restart backend after adding:
```bash
# Kill and restart
pkill -f node
npm run start:dev
```

---

## 📋 Complete Debug Checklist

### Frontend:
- [x] ✅ Fixed: `auth: { token }` not `handshake.auth.token`
- [ ] Token exists in localStorage
- [ ] Token is valid JWT format (3 parts)
- [ ] Token not expired
- [ ] Token sent in socket connection

### Backend:
- [ ] JWT_SECRET configured in `.env`
- [ ] JwtModule properly initialized
- [ ] Socket gateway has handleConnection
- [ ] `client.handshake.auth.token` accessed correctly
- [ ] jwtService.verifyAsync() called
- [ ] Error handling in place

### Testing:
- [ ] Browser console shows no errors
- [ ] DevTools Network shows WebSocket connection
- [ ] Backend logs show authentication success
- [ ] Socket connects without disconnect

---

## 🎯 Expected Flow

**1. User logs in:**
```
Google OAuth → Backend /auth/login → JWT token → localStorage
```

**2. Socket connects:**
```
Frontend: Get token from localStorage
Frontend: Pass to socket.io with auth: { token }
Backend: Read from client.handshake.auth.token
Backend: Verify with jwtService
Backend: Store user info in client.data
✅ Connected!
```

**3. Send messages:**
```
Frontend: socket.emit('send_message', data)
Backend: Get userId from client.data.userId
Backend: Process message
Backend: Broadcast to room
✅ Message delivered!
```

---

## 🚀 Quick Test Script

Save as `test-socket-auth.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Socket Auth Test</title>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
  <h1>Socket.IO Authentication Test</h1>
  <div id="status">Connecting...</div>
  <div id="logs"></div>

  <script>
    const token = localStorage.getItem('auth_token') || 'test-token'
    
    console.log('Testing with token:', token)
    
    const socket = io('http://localhost:1200', {
      auth: {
        token: token
      }
    })
    
    socket.on('connect', () => {
      document.getElementById('status').innerHTML = '✅ Connected!'
      document.getElementById('status').style.color = 'green'
      console.log('✅ Connected:', socket.id)
    })
    
    socket.on('connect_error', (error) => {
      document.getElementById('status').innerHTML = '❌ Connection Error'
      document.getElementById('status').style.color = 'red'
      document.getElementById('logs').innerHTML = error.message
      console.error('❌ Error:', error)
    })
    
    socket.on('error', (error) => {
      console.error('❌ Socket error:', error)
      document.getElementById('logs').innerHTML += '<br>' + JSON.stringify(error)
    })
    
    socket.on('disconnect', (reason) => {
      document.getElementById('status').innerHTML = '⚠️ Disconnected: ' + reason
      document.getElementById('status').style.color = 'orange'
      console.log('Disconnected:', reason)
    })
  </script>
</body>
</html>
```

Open in browser and check console!

---

**Last Updated:** 2025-10-20  
**Status:** ✅ Frontend fixed, backend needs JWT_SECRET
