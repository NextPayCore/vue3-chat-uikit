<template>
  <el-input type="text" v-model="message" placeholder="Message">
    <template #append>
      <el-button @click="sendMessage">Send</el-button>
    </template>
  </el-input>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const message = ref('')

const sendMessage = () => {
  console.log(message.value)
}
</script>
