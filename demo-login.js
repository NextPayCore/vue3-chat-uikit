// Demo Helper - Test Login Without Google Client ID
// Paste this code into Browser Console to simulate login

console.log('🎯 Demo Login Helper')
console.log('================================')

// Method 1: Mock user data in localStorage
const mockUser = {
  id: 'demo-123',
  name: 'Demo User',
  email: 'demo@example.com',
  avatarUrl: 'https://i.pravatar.cc/150?img=8',
  provider: 'google'
}

localStorage.setItem('auth_user', JSON.stringify(mockUser))
console.log('✅ Mock user saved to localStorage')
console.log('👤 User:', mockUser)
console.log('')
console.log('🔄 Refreshing page...')
setTimeout(() => location.reload(), 1000)

// ================================
// To Sign Out:
// localStorage.removeItem('auth_user')
// location.reload()
// ================================
