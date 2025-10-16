# Vue3 Chat UI Kit

A modern and flexible chat UI kit component for Vue 3 with TypeScript support.

## Installation

```bash
npm install vue3-chat-uikit
```

## Usage

### Global Installation

```typescript
import { createApp } from 'vue'
import Vue3ChatUIKit from 'vue3-chat-uikit'
import 'vue3-chat-uikit/style.css'

const app = createApp(App)
app.use(Vue3ChatUIKit)
```

### Component Import

```typescript
import { ChatInput, ChatList } from 'vue3-chat-uikit'
import 'vue3-chat-uikit/style.css'
```

### TypeScript Support

```typescript
import type { IChatInput, IMessage } from 'vue3-chat-uikit'
import { ChatInputType, MessageTypeEnum } from 'vue3-chat-uikit'
```

## Components

### ChatInput

A chat input component for sending messages.

```vue
<template>
  <ChatInput />
</template>
```

### ChatList

A chat list component for displaying messages.

```vue
<template>
  <ChatList :messages="messages" />
</template>

<script setup lang="ts">
import type { IMessage } from 'vue3-chat-uikit'

const messages: IMessage[] = [
  {
    id: '1',
    content: 'Hello!',
    sender: 'user1',
    receiver: 'user2',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]
</script>
```

## Types

### IChatInput

```typescript
interface IChatInput {
  message: string
  sendMessage: () => void
}
```

### IMessage

```typescript
interface IMessage {
  id: string
  content: string
  sender: string
  receiver: string
  createdAt: Date
  updatedAt: Date
}
```

## Enums

### ChatInputType

```typescript
enum ChatInputType {
  TEXT = 'text',
  VOICE = 'voice',
  IMAGE = 'image',
}
```

### MessageType

```typescript
enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
}
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build library
npm run build

# Type check
npm run type-check

# Lint
npm run lint

# Format
npm run format
```

## License

MIT
