import { createApp, type Component } from 'vue'
import './assets/main.css'
import 'element-plus/dist/index.css'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import vue3GoogleLogin from 'vue3-google-login'
import App from './App.vue'

const app = createApp(App)

// Element Plus
app.use(ElementPlus)

// Google Login - Use popup mode to get JWT token directly
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
app.use(vue3GoogleLogin, {
  clientId: GOOGLE_CLIENT_ID,
  // Use popup instead of redirect to get JWT token
  popupType: 'TOKEN'
})

// Register Element Plus icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as Component)
}

app.mount('#app')
