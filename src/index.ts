import type { App } from 'vue'
import ChatInput from './components/ChatInput.vue'
import ChatList from './components/ChatList.vue'
import LoginModal from './components/LoginModal.vue'

// Export components
export { ChatInput, ChatList, LoginModal }

// Export composables
export { useSocket } from './composables/useSocket'
export { useAuth } from './composables/useAuth'

// Export types
export type { IMessage, IMessageShow, IAttachment } from './interfaces/message.interface'
export type { AuthUser } from './composables/useAuth'

// Export enums
export { ChatInputType } from './enums/chatinput.enum'
export { MessageStatusEnum, MessageRole } from './enums/message.enum'
export { SocketEventEnum, SocketStatusEnum } from './enums/socket.enum'
export type { IChatInput, IUploadedFile } from './interfaces/chatinput.interface'

// Install function for Vue app
export const install = (app: App) => {
  app.component('ChatInput', ChatInput)
  app.component('ChatList', ChatList)
  app.component('LoginModal', LoginModal)
}

// Default export
const Vue3ChatUIKit = {
  install,
  ChatInput,
  ChatList,
  LoginModal,
}

export default Vue3ChatUIKit
