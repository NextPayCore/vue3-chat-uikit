import type { App } from 'vue'
import ChatInput from './components/ChatInput.vue'
import ChatList from './components/ChatList.vue'

// Export components
export { ChatInput, ChatList }

// Export types
export type { IMessage, IMessageShow, IAttachment } from './interfaces/message.interface'

// Export enums
export { ChatInputType } from './enums/chatinput.enum'
export { MessageStatusEnum } from './enums/message.enum'
export type { IChatInput, IUploadedFile } from './interfaces/chatinput.interface'

// Export enums
export { MessageType as MessageTypeEnum, MessageRole } from './enums/message.enum'

// Install function for Vue app
export const install = (app: App) => {
  app.component('ChatInput', ChatInput)
  app.component('ChatList', ChatList)
}

// Default export
const Vue3ChatUIKit = {
  install,
  ChatInput,
  ChatList,
}

export default Vue3ChatUIKit
