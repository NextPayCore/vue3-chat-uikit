import type { App } from 'vue'
import ChatInput from './components/ChatInput.vue'
import ChatList from './components/ChatList.vue'

// Export components
export { ChatInput, ChatList }

// Export types
export type { IChatInput } from './interfaces/chatinput.interface'
export type { IMessage } from './interfaces/message.interface'

// Export enums
export { ChatInputType } from './enums/chatinput.enum'
export { MessageType as MessageTypeEnum } from './enums/message.enum'

// Install function for Vue app
export const install = (app: App) => {
  app.component('ChatInput', ChatInput)
  app.component('ChatList', ChatList)
}

// Default export
export default {
  install,
  ChatInput,
  ChatList,
}
