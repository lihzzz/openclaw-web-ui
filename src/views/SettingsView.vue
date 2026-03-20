<script setup lang="ts">
import { useRouter } from 'vue-router'
import SettingsPanel from '@/components/SettingsPanel.vue'

const router = useRouter()

// 返回聊天页面
function goBack(): void {
  router.push('/')
}
</script>

<template>
  <div class="settings-view">
    <header class="settings-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        返回聊天
      </button>
    </header>
    
    <main class="settings-main">
      <SettingsPanel />
    </main>
  </div>
</template>

<style scoped>
.settings-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.settings-header {
  padding: 1rem 2rem;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(0, 245, 255, 0.1);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  color: #00f5ff;
  background: transparent;
  border: 1px solid rgba(0, 245, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(0, 245, 255, 0.1);
  border-color: rgba(0, 245, 255, 0.4);
}

.settings-main {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}
</style>