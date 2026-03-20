<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useDeviceStore } from '@/stores/deviceStore'

const chatStore = useChatStore()
const deviceStore = useDeviceStore()

// 本地表单状态
const localSettings = ref({
  host: chatStore.settings.host,
  port: chatStore.settings.port,
  token: chatStore.settings.token,
  connectionTimeout: chatStore.settings.connectionTimeout ?? 10000,
  reconnectInterval: chatStore.settings.reconnectInterval ?? 3000
})

// 显示 Token
const showToken = ref(false)

// 是否有未保存的更改
const hasChanges = computed(() => {
  return (
    localSettings.value.host !== chatStore.settings.host ||
    localSettings.value.port !== chatStore.settings.port ||
    localSettings.value.token !== chatStore.settings.token ||
    localSettings.value.connectionTimeout !== chatStore.settings.connectionTimeout ||
    localSettings.value.reconnectInterval !== chatStore.settings.reconnectInterval
  )
})

// 保存设置
function saveSettings(): void {
  chatStore.updateSettings(localSettings.value)
}

// 重置设置
function resetSettings(): void {
  localSettings.value = {
    host: chatStore.settings.host,
    port: chatStore.settings.port,
    token: chatStore.settings.token,
    connectionTimeout: chatStore.settings.connectionTimeout ?? 10000,
    reconnectInterval: chatStore.settings.reconnectInterval ?? 3000
  }
}

// 测试连接
async function testConnection(): Promise<void> {
  // 先断开现有连接
  chatStore.disconnect()
  
  // 保存设置
  saveSettings()
  
  // 尝试连接
  chatStore.connect()
}

// 切换 Session 模式
function toggleSessionMode(): void {
  deviceStore.toggleSessionMode()
}

// 清空消息
function clearMessages(): void {
  if (confirm('确定要清空所有消息吗？')) {
    chatStore.clearMessages()
  }
}
</script>

<template>
  <div class="settings-panel">
    <h2 class="settings-title">设置</h2>
    
    <!-- 连接设置 -->
    <section class="settings-section">
      <h3 class="section-title">连接设置</h3>
      
      <div class="form-group">
        <label class="form-label">Gateway 主机</label>
        <input
          v-model="localSettings.host"
          type="text"
          class="form-input"
          placeholder="127.0.0.1"
        />
      </div>
      
      <div class="form-group">
        <label class="form-label">端口</label>
        <input
          v-model.number="localSettings.port"
          type="number"
          class="form-input"
          placeholder="18789"
        />
      </div>
      
      <div class="form-group">
        <label class="form-label">认证 Token</label>
        <div class="token-input-group">
          <input
            v-model="localSettings.token"
            :type="showToken ? 'text' : 'password'"
            class="form-input"
            placeholder="输入 Token"
          />
          <button
            class="toggle-token-btn"
            @click="showToken = !showToken"
            :title="showToken ? '隐藏' : '显示'"
          >
            {{ showToken ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">连接超时 (毫秒)</label>
        <input
          v-model.number="localSettings.connectionTimeout"
          type="number"
          class="form-input"
          placeholder="10000"
          min="1000"
          max="60000"
        />
      </div>

      <div class="form-group">
        <label class="form-label">重连间隔 (毫秒)</label>
        <input
          v-model.number="localSettings.reconnectInterval"
          type="number"
          class="form-input"
          placeholder="3000"
          min="1000"
          max="30000"
        />
      </div>
    </section>
    
    <!-- Session 设置 -->
    <section class="settings-section">
      <h3 class="section-title">Session 设置</h3>
      
      <div class="session-info">
        <div class="info-row">
          <span class="info-label">设备 ID</span>
          <span class="info-value">{{ deviceStore.shortDeviceId }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Session Key</span>
          <span class="info-value code">{{ deviceStore.sessionKey }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">显示名称</span>
          <span class="info-value">{{ deviceStore.displayName }}</span>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-checkbox">
          <input
            :checked="deviceStore.useSharedSession"
            type="checkbox"
            @change="toggleSessionMode"
          />
          <span>使用共享 Session（所有用户共享对话）</span>
        </label>
      </div>
    </section>
    
    <!-- 操作按钮 -->
    <section class="settings-section">
      <div class="button-group">
        <button
          class="btn btn-primary"
          :disabled="!hasChanges"
          @click="saveSettings"
        >
          保存设置
        </button>
        <button
          class="btn btn-secondary"
          :disabled="!hasChanges"
          @click="resetSettings"
        >
          重置
        </button>
      </div>
      
      <div class="button-group">
        <button class="btn btn-success" @click="testConnection">
          测试连接
        </button>
        <button class="btn btn-danger" @click="clearMessages">
          清空消息
        </button>
      </div>
    </section>
    
    <!-- 连接状态 -->
    <section class="settings-section">
      <h3 class="section-title">连接状态</h3>
      <div class="connection-status" :class="chatStore.connectionState">
        <span class="status-dot"></span>
        <span class="status-text">
          {{ chatStore.connectionState === 'connected' ? '已连接' : 
             chatStore.connectionState === 'connecting' ? '连接中...' :
             chatStore.connectionState === 'authenticating' ? '认证中...' : '未连接' }}
        </span>
      </div>
      <div v-if="chatStore.connectionError" class="connection-error">
        {{ chatStore.connectionError }}
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-panel {
  padding: 1.5rem;
  max-width: 600px;
  margin: 0 auto;
}

.settings-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #00f5ff;
  margin-bottom: 1.5rem;
}

.settings-section {
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(0, 245, 255, 0.1);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #00f5ff;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  font-size: 0.85rem;
  color: #6b8fb8;
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  color: #e0e6ed;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 245, 255, 0.2);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #00f5ff;
}

.token-input-group {
  display: flex;
  gap: 0.5rem;
}

.token-input-group .form-input {
  flex: 1;
}

.toggle-token-btn {
  padding: 0.5rem 0.75rem;
  background: rgba(0, 245, 255, 0.1);
  border: 1px solid rgba(0, 245, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-token-btn:hover {
  background: rgba(0, 245, 255, 0.2);
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.form-checkbox input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.form-checkbox span {
  color: #e0e6ed;
}

.session-info {
  margin-bottom: 1rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-label {
  color: #6b8fb8;
  font-size: 0.85rem;
}

.info-value {
  color: #e0e6ed;
  font-size: 0.85rem;
}

.info-value.code {
  font-family: 'JetBrains Mono', monospace;
  color: #00f5ff;
}

.button-group {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.btn {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:active:not(:disabled) {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  color: #0a0e17;
  background: linear-gradient(135deg, #00f5ff 0%, #00d4aa 100%);
}

.btn-secondary {
  color: #e0e6ed;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-success {
  color: #0a0e17;
  background: linear-gradient(135deg, #00ff88 0%, #00d4aa 100%);
}

.btn-danger {
  color: #fff;
  background: linear-gradient(135deg, #ff4444 0%, #ff6b6b 100%);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff4444;
}

.connection-status.connected .status-dot {
  background: #00ff88;
}

.connection-status.connecting .status-dot,
.connection-status.authenticating .status-dot {
  background: #ffd700;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  color: #e0e6ed;
  font-size: 0.9rem;
}

.connection-error {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  color: #ff6b6b;
  background: rgba(255, 68, 68, 0.1);
  border-radius: 8px;
  font-size: 0.85rem;
}
</style>