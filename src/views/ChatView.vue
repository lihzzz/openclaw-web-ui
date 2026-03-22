<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import MessageList from '@/components/MessageList.vue'
import InputArea from '@/components/InputArea.vue'
import TypingIndicator from '@/components/TypingIndicator.vue'
import SettingsModal from '@/components/SettingsModal.vue'

const chatStore = useChatStore()

// 输入框引用
const inputAreaRef = ref<InstanceType<typeof InputArea> | null>(null)

// 消息列表容器引用
const messagesContainer = ref<HTMLElement | null>(null)

// 组件是否已挂载
const isMounted = ref(false)

// 滚动到底部
async function scrollToBottom(): Promise<void> {
  await nextTick()
  if (messagesContainer.value) {
    // 使用 scrollIntoView 确保滚动到最底部
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 延迟滚动（确保内容渲染完成）
function delayedScroll(): void {
  setTimeout(() => scrollToBottom(), 100)
  setTimeout(() => scrollToBottom(), 300)
}

// 发送消息
async function handleSend(message: string): Promise<void> {
  try {
    await chatStore.sendMessage(message)
    await scrollToBottom()
    inputAreaRef.value?.focus()
  } catch (error) {
    // 发送失败，静默处理
  }
}

// 重置会话
async function handleReset(): Promise<void> {
  await chatStore.resetSession()
  inputAreaRef.value?.focus()
}

// 中止当前运行
function handleAbort(): void {
  chatStore.abort()
}

// 关闭设置弹窗
function closeSettings(): void {
  chatStore.showSettingsModal = false
  inputAreaRef.value?.focus()
}

// 保存消息（用于页面离开时）
function saveBeforeLeave(): void {
  chatStore.flushSaveMessages()
}

// 监听消息变化，自动滚动（深度监听消息内容）
watch(
  () => chatStore.messages,
  () => {
    nextTick(() => scrollToBottom())
  },
  { deep: true }
)

// 监听打字状态，自动滚动
watch(
  () => chatStore.isTyping,
  (isTyping) => {
    if (isTyping) {
      delayedScroll()
    }
  }
)

// 监听连接状态，连接成功后关闭弹窗
watch(
  () => chatStore.isConnected,
  (isConnected) => {
    if (isConnected) {
      chatStore.showSettingsModal = false
    }
  }
)

// 组件挂载后初始化
onMounted(async () => {
  isMounted.value = true

  // 等待 DOM 更新
  await nextTick()

  // 滚动到底部（消息可能从 localStorage 加载）
  delayedScroll()

  // 如果未连接，尝试连接
  if (!chatStore.isConnected) {
    chatStore.connect()
  }

  // 聚焦输入框
  inputAreaRef.value?.focus()
})

// 组件卸载前保存消息
onBeforeUnmount(() => {
  saveBeforeLeave()
})

// 路由离开前保存消息
onBeforeRouteLeave(() => {
  saveBeforeLeave()
})
</script>

<template>
  <div class="chat-layout">
    <!-- 主聊天区域 -->
    <div class="chat-view">
      <!-- 消息列表 -->
      <div ref="messagesContainer" class="messages-container">
        <div class="messages-inner">
          <MessageList :messages="chatStore.messages" />
        </div>
      </div>

      <!-- 打字指示器 -->
      <div v-if="chatStore.isTyping" class="typing-indicator">
        <TypingIndicator :duration="chatStore.typingDuration" />
        <button class="abort-btn" @click="handleAbort">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          <span>停止</span>
        </button>
      </div>

      <!-- 输入区域 -->
      <div class="input-wrapper">
        <InputArea
          ref="inputAreaRef"
          :disabled="!chatStore.isConnected"
          @send="handleSend"
          @reset="handleReset"
        />
      </div>

      <!-- 设置弹窗 -->
      <Teleport to="body">
        <Transition name="modal">
          <div
            v-if="chatStore.showSettingsModal"
            class="modal-overlay"
            @click.self="closeSettings"
          >
            <SettingsModal />
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: transparent;
}

.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  overflow: hidden;
  background: transparent;
  min-width: 0;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  min-height: 0;
}

.messages-inner {
  max-width: 100%;
  margin: 0;
  padding: 0;
}

.typing-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.abort-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: var(--font-mono);
  color: var(--error);
  background: var(--error-dim);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.abort-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: var(--error);
}

.input-wrapper {
  padding: 1rem 1.5rem;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.input-wrapper :deep(.input-area) {
  max-width: 800px;
  margin: 0 auto;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-slow);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .settings-modal,
.modal-leave-active .settings-modal {
  transition: transform var(--transition-slow), opacity var(--transition-slow);
}

.modal-enter-from .settings-modal,
.modal-leave-to .settings-modal {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

@media (max-width: 640px) {
  .messages-container {
    padding: 1rem;
  }

  .input-wrapper {
    padding: 0.75rem 1rem;
  }
}


</style>