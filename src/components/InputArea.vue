<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled?: boolean
  placeholder?: string
  disconnectedPlaceholder?: string
}>()

const emit = defineEmits<{
  send: [message: string]
  reset: []
}>()

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 发送消息
function handleSend(): void {
  if (!inputText.value.trim() || props.disabled) return

  emit('send', inputText.value.trim())
  inputText.value = ''

  // 重置输入框高度
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

// 重置会话
function handleReset(): void {
  if (props.disabled) return
  emit('reset')
}

// 处理键盘事件
function handleKeydown(event: KeyboardEvent): void {
  // Shift+Enter 发送，Enter 换行
  if (event.key === 'Enter' && event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

// 自动调整高度
function adjustHeight(): void {
  if (textareaRef.value) {
    // 先重置高度为 auto 计算实际高度
    textareaRef.value.style.height = 'auto'
    // 获取内容真实高度
    const scrollHeight = textareaRef.value.scrollHeight
    // 限制最大高度为 200px
    const newHeight = Math.min(scrollHeight, 200)
    textareaRef.value.style.height = newHeight + 'px'
  }
}

// 聚焦输入框
function focus(): void {
  textareaRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="input-area">
    <div class="input-container">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        :placeholder="disabled ? (disconnectedPlaceholder || '请先连接 Gateway...') : (placeholder || '输入消息...')"
        :disabled="disabled"
        class="input-textarea"
        rows="1"
        @keydown="handleKeydown"
        @input="adjustHeight"
      />
      <div class="button-group">
        <button
          class="reset-button"
          :disabled="disabled"
          @click="handleReset"
          title="重置会话 (/new)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
        <button
          class="send-button"
          :disabled="disabled || !inputText.trim()"
          @click="handleSend"
          title="发送消息 (Shift+Enter)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
    <div class="input-hint">
      <span>Shift + Enter 发送</span>
    </div>
  </div>
</template>

<style scoped>
.input-area {
  max-width: 800px;
  margin: 0 auto;
}

.input-container {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.input-textarea {
  flex: 1;
  min-height: 52px;
  max-height: 200px;
  padding: 0.875rem 1.25rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  resize: none;
  outline: none;
  font-family: var(--font-body);
  transition: all var(--transition-fast);
  overflow: hidden;
}

.input-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
  background: var(--bg-elevated);
}

.input-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-secondary);
}

.input-textarea::placeholder {
  color: var(--text-muted);
}

.button-group {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.reset-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.reset-button:hover:not(:disabled) {
  color: var(--warning);
  background: var(--bg-elevated);
  border-color: var(--warning);
}

.reset-button:active:not(:disabled) {
  transform: scale(0.95);
}

.reset-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  color: var(--bg-primary);
  background: var(--accent);
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--glow-accent);
}

.send-button:hover:not(:disabled) {
  background: var(--accent-light);
  box-shadow: var(--glow-accent-strong);
  transform: translateY(-1px);
}

.send-button:active:not(:disabled) {
  transform: translateY(0) scale(0.95);
}

.send-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--bg-elevated);
  box-shadow: none;
}

.input-hint {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
</style>
