<template>
  <ul class="chat-list">
    <li class="chat-item" v-for="message in messages" :key="message.id">
      <p>{{ message.content }}</p>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const messages = ref<{ id: string; content: string }[]>([])
</script>
