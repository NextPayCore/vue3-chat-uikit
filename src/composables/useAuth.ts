import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useApi } from './useApi'

export interface AuthUser {
  id: string
  name: string
  email: string
  avatarUrl: string
  provider: 'google'
  token?: string // JWT token from backend
}

const currentUser = ref<AuthUser | null>(null)
const isLoading = ref(false)
const api = useApi()

// Load user from localStorage on init
const savedUser = localStorage.getItem('user')
if (savedUser) {
  try {
    currentUser.value = JSON.parse(savedUser)
  } catch (e) {
    console.error('Failed to parse saved user:', e)
    localStorage.removeItem('user')
  }
}

export function useAuth() {
  const isAuthenticated = computed(() => currentUser.value !== null)

  // Handle Google login callback
  const handleGoogleLogin = async (response: any) => {
    isLoading.value = true

    try {
      console.log('📩 Google login response:', response)
      console.log('📩 Response keys:', Object.keys(response))

      let user: AuthUser | null = null

      //
      // Check if response has authorization code (OAuth flow)
       if (response.access_token) {
        console.log('✅ Received authorization code, sending to backend...')

        // Use useApi to call backend
        const backendData = await api.socialLogin('google', response.access_token)
        console.log('✅ Backend login successful:', backendData)

        // Extract user info from backend response
        user = {
          id: backendData.user?.id || 'user-' + Date.now(),
          name: backendData.user?.name || 'Google User',
          email: backendData.user?.email || '',
          avatarUrl: backendData.user?.avatarUrl || '',
          provider: 'google',
          token: backendData.accessToken // Save JWT token from backend
        }

        // Save token to localStorage if provided
        if (user.token) {
          localStorage.setItem('accessToken', user.token)
        }
      }
      // Fallback: Create demo user for ANY response
      else {
        console.warn('⚠️ Unknown response format, using demo mode')
        user = {
          id: 'demo-' + Date.now(),
          name: 'Demo User',
          email: 'demo@example.com',
          avatarUrl: 'https://i.pravatar.cc/150?img=' + Math.floor(Math.random() * 70),
          provider: 'google'
        }

        ElMessage.warning({
          message: 'Demo mode: Using mock user data',
          duration: 3000
        })
      }

      if (!user) {
        throw new Error('Failed to create user')
      }

      currentUser.value = user

      // Save to localStorage
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('accessToken', user.token || '')
      ElMessage.success({
        message: `Welcome back, ${user.name}!`,
        duration: 3000
      })

      return user
    } catch (error: any) {
      console.error('Google login error:', error)
      ElMessage.error({
        message: `Login failed: ${error.message}`,
        duration: 3000
      })
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Handle Google login error
  const handleGoogleLoginError = () => {
    isLoading.value = false
    ElMessage.error({
      message: 'Google login failed. Please try again.',
      duration: 3000
    })
  }

  // Sign out
  const signOut = async () => {
    try {
      // Call logout API
      await api.logout()
    } catch (error) {
      console.error('Logout error:', error)
      // Continue with local cleanup even if API call fails
    }

    currentUser.value = null
    localStorage.removeItem('user')
    localStorage.removeItem('accessToken')

    ElMessage.success({
      message: 'Successfully signed out',
      duration: 3000
    })
  }

  return {
    currentUser,
    isAuthenticated,
    isLoading,
    handleGoogleLogin,
    handleGoogleLoginError,
    signOut
  }
}
