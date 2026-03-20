<script setup lang="ts">
import { RouterView } from 'vue-router'
import Sidebar from '@/components/Sidebar.vue'
</script>

<template>
  <div class="app-container">
    <!-- 左侧导航栏 -->
    <Sidebar />

    <!-- 主内容区域 -->
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  z-index: 2;
}

.app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin-left: 180px;
}
</style>