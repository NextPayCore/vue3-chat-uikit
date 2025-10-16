<template>
  <ul class="chat-list">
    <li
      class="chat-item"
      :class="{ 'is-me': message.isMe }"
      v-for="message in messagesShow"
      :key="message.id"
    >
      <p>{{ message.contentText }}</p>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IMessage, IMessageShow } from '../interfaces/message.interface'

const props = withDefaults(
  defineProps<{
    messages: IMessage[]
    isLoading: boolean
    selfId: string
  }>(),
  {
    messages: () => [],
    isLoading: false,
    selfId: '',
  },
)

const messagesShow = computed<IMessageShow[]>(() => {
  return props.messages.map((message) => ({
    ...message,
    isMe: message.sender === props.selfId,
  }))
})
</script>
