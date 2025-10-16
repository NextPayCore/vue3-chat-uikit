<template>
  <el-container>
    <el-header>
      <h1>Chat demo</h1>
    </el-header>
    <el-main>
      <el-row :gutter="20">
        <el-col :span="24">
          <ChatList />
        </el-col>
        <el-col :span="24">
          <ChatInput />
        </el-col>
      </el-row>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import ChatList from './components/ChatList.vue'
import ChatInput from './components/ChatInput.vue'
</script>

<style scoped></style>
