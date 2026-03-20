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
  min-height: 48px;
  max-height: 200px;
  padding: 0.875rem 1.125rem;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--text-primary);
  background: rgba(5, 5, 5, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  resize: none;
  outline: none;
  font-family: var(--font-body);
  transition: all var(--transition-fast);
  overflow: hidden;
}

.input-textarea:focus {
  border-color: var(--gold-primary);
  box-shadow: var(--glow-gold);
  background: rgba(212, 175, 55, 0.03);
}

.input-textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  width: 48px;
  height: 48px;
  color: var(--text-secondary);
  background: rgba(115, 115, 115, 0.15);
  border: 1px solid rgba(115, 115, 115, 0.25);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.reset-button:hover:not(:disabled) {
  color: var(--warning);
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.4);
  box-shadow: 0 0 15px rgba(245, 158, 11, 0.3);
}

.reset-button:active:not(:disabled) {
  transform: scale(0.95);
}

.reset-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: var(--abyss-black);
  background: linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dark) 100%);
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: var(--glow-gold);
  transition: all var(--transition-fast);
}

.send-button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: var(--glow-gold-strong);
}

.send-button:active:not(:disabled) {
  transform: scale(0.98);
}

.send-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.input-hint {
  margin-top: 0.5rem;
  text-align: right;
}

.input-hint span {
  font-size: 0.6875rem;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .input-textarea {
    font-size: 1rem;
    padding: 0.75rem 1rem;
  }

  .reset-button,
  .send-button {
    width: 44px;
    height: 44px;
  }
}
</style>