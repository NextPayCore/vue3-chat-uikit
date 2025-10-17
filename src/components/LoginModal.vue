<template>
  <el-dialog
    v-model="visible"
    title="Sign In"
    width="480px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    align-center
  >
    <div class="login-content">
      <div class="login-header">
        <h2>Welcome to ChatGPT Clone</h2>
        <p>Sign in to start chatting</p>
      </div>

      <div class="login-buttons">
        <GoogleLogin
          :callback="handleGoogleLogin"
          :error="handleGoogleError"
        >
          <div class="google-button">
            <svg class="button-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          </div>
        </GoogleLogin>
      </div>

      <div class="login-footer">
        <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElDialog } from 'element-plus'
import { GoogleLogin } from 'vue3-google-login'
import { useAuth } from '../composables/useAuth'

interface LoginModalProps {
  modelValue: boolean
}

interface LoginModalEmits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<LoginModalProps>()
const emit = defineEmits<LoginModalEmits>()

const { handleGoogleLogin: authHandleGoogleLogin, handleGoogleLoginError } = useAuth()

const visible = ref(props.modelValue)

watch(() => props.modelValue, (newValue) => {
  visible.value = newValue
})

watch(visible, (newValue) => {
  emit('update:modelValue', newValue)
})

const handleGoogleLogin = (response: any) => {
  try {
    authHandleGoogleLogin(response)
    visible.value = false
    emit('success')
  } catch (error) {
    console.error('Login error:', error)
  }
}

const handleGoogleError = () => {
  handleGoogleLoginError()
}
</script>

<style scoped>
.login-content {
  padding: 20px 0;
  max-width: 100%;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h2 {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 8px 0;
}

.login-header p {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.login-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.google-button {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 15px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.3s ease;
  background: white;
  color: #3c4043;
  border: 1px solid #e0e0e0;
  cursor: pointer;
  padding: 0 24px;
}

.google-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  background: #f8f9fa;
  border-color: #dadce0;
}

.button-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
}

.login-footer p {
  font-size: 12px;
  color: #999;
  line-height: 1.5;
  margin: 0;
}

@media (max-width: 480px) {
  .login-header h2 {
    font-size: 20px;
  }

  .google-button {
    height: 44px;
    font-size: 14px;
  }
}
</style>
