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
  token: chatStore.settings.token
})

// 显示 Token
const showToken = ref(false)

// 是否有未保存的更改
const hasChanges = computed(() => {
  return (
    localSettings.value.host !== chatStore.settings.host ||
    localSettings.value.port !== chatStore.settings.port ||
    localSettings.value.token !== chatStore.settings.token
  )
})

// 保存设置
function saveSettings(): void {
  chatStore.updateSettings(localSettings.value)
}

// 连接/断开
function toggleConnection(): void {
  if (chatStore.isConnected) {
    chatStore.disconnect()
  } else {
    saveSettings()
    chatStore.connect()
  }
}

// 关闭弹窗
function closeModal(): void {
  chatStore.showSettingsModal = false
}
</script>

<template>
  <div class="settings-modal" @click.stop>
    <div class="modal-header">
      <h3 class="modal-title">连接设置</h3>
      <button class="close-btn" @click="closeModal">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <div class="modal-body">
      <!-- 连接状态 -->
      <div class="status-section">
        <div class="status-badge" :class="chatStore.connectionState">
          <span class="status-dot"></span>
          <span class="status-text">
            {{ chatStore.connectionState === 'connected' ? '已连接' :
               chatStore.connectionState === 'connecting' ? '连接中...' :
               chatStore.connectionState === 'authenticating' ? '认证中...' : '未连接' }}
          </span>
        </div>
        <div v-if="chatStore.connectionError" class="error-message">
          {{ chatStore.connectionError }}
        </div>
      </div>

      <!-- Session Key -->
      <div class="field-group">
        <label class="field-label">Session Key</label>
        <div class="session-key">
          <code>{{ deviceStore.sessionKey }}</code>
        </div>
      </div>

      <!-- 主机和端口 -->
      <div class="field-row">
        <div class="field-group field-flex">
          <label class="field-label">主机</label>
          <input
            v-model="localSettings.host"
            type="text"
            class="field-input"
            placeholder="127.0.0.1"
          />
        </div>
        <div class="field-group field-small">
          <label class="field-label">端口</label>
          <input
            v-model.number="localSettings.port"
            type="number"
            class="field-input"
            placeholder="18789"
          />
        </div>
      </div>

      <!-- Token -->
      <div class="field-group">
        <label class="field-label">Token</label>
        <div class="token-field">
          <input
            v-model="localSettings.token"
            :type="showToken ? 'text' : 'password'"
            class="field-input"
            placeholder="输入 Token"
          />
          <button class="toggle-btn" @click="showToken = !showToken">
            <svg v-if="showToken" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button
        v-if="hasChanges"
        class="btn btn-secondary"
        @click="saveSettings"
      >
        保存设置
      </button>
      <button
        class="btn"
        :class="chatStore.isConnected ? 'btn-danger' : 'btn-primary'"
        @click="toggleConnection"
      >
        {{ chatStore.isConnected ? '断开连接' : '连接' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings-modal {
  background: var(--bg-secondary);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 380px;
  overflow: hidden;
  animation: fadeIn var(--transition-normal);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--accent);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--text-muted);
  background: transparent;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  color: var(--accent);
  background: var(--accent-dim);
}

.modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius);
  border: 1px solid var(--border-subtle);
  width: fit-content;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--error);
}

.status-badge.connected .status-dot {
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
  animation: pulse 2s ease-in-out infinite;
}

.status-badge.connecting .status-dot,
.status-badge.authenticating .status-dot {
  background: var(--warning);
  animation: pulse 1.5s infinite;
}

.status-text {
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-badge.connected .status-text {
  color: var(--success);
}

.error-message {
  padding: 0.625rem 0.875rem;
  font-size: 0.8125rem;
  color: var(--error);
  background: var(--error-dim);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius);
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-row {
  display: flex;
  gap: 0.75rem;
}

.field-flex {
  flex: 1;
}

.field-small {
  width: 100px;
  flex-shrink: 0;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 500;
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.field-input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  outline: none;
  font-family: var(--font-body);
  transition: all var(--transition-fast);
}

.field-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
  background: var(--bg-elevated);
}

.field-input::placeholder {
  color: var(--text-muted);
}

.session-key {
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  overflow-x: auto;
}

.session-key code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--accent);
}

.token-field {
  display: flex;
  gap: 0.5rem;
}

.token-field .field-input {
  flex: 1;
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--text-muted);
  background: rgba(3, 7, 17, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.toggle-btn:hover {
  color: var(--bio-cyan);
  border-color: var(--bio-cyan);
  box-shadow: var(--glow-cyan);
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-glass);
  background: rgba(3, 7, 17, 0.4);
}

.btn {
  flex: 1;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  color: var(--abyss-black);
  background: linear-gradient(135deg, var(--success) 0%, #00cc6a 100%);
  border: none;
  box-shadow: var(--glow-success);
}

.btn-primary:hover {
  box-shadow: 0 0 40px rgba(0, 255, 136, 0.5);
  transform: scale(1.02);
}

.btn-secondary {
  color: var(--bio-cyan);
  background: transparent;
  border: 1px solid var(--bio-cyan);
}

.btn-secondary:hover {
  background: var(--bio-cyan-dim);
  box-shadow: var(--glow-cyan);
}

.btn-danger {
  color: white;
  background: linear-gradient(135deg, var(--error) 0%, #cc0033 100%);
  border: none;
  box-shadow: var(--glow-error);
}

.btn-danger:hover {
  box-shadow: 0 0 40px rgba(255, 51, 102, 0.5);
  transform: scale(1.02);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>