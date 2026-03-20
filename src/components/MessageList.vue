<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '@/stores/chat'
import { renderMarkdown } from '@/utils/markdown'
import ToolCallsPanel from './ToolCallsPanel.vue'

const props = defineProps<{
  messages: Message[]
}>()

// 按时间排序的消息
const sortedMessages = computed(() => {
  return [...props.messages].sort((a, b) => a.timestamp - b.timestamp)
})

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取角色显示名称
function getRoleName(role: string): string {
  switch (role) {
    case 'user':
      return '你'
    case 'assistant':
      return 'Agent'
    case 'system':
      return '系统'
    default:
      return role
  }
}
</script>

<template>
  <div class="message-list">
    <div
      v-for="message in sortedMessages"
      :key="message.id"
      class="message"
      :class="`message-${message.role}`"
    >
      <div class="message-avatar" :class="`avatar-${message.role}`">
        <template v-if="message.role === 'user'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </template>
        <template v-else>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </template>
      </div>

      <div class="message-body">
        <div class="message-header">
          <span class="message-role">{{ getRoleName(message.role) }}</span>
          <span class="message-time">{{ formatTime(message.timestamp) }}</span>
        </div>

        <div class="message-content-wrapper">
          <div
            class="message-content"
            v-html="renderMarkdown(message.content)"
          />

          <!-- 工具调用面板 -->
          <ToolCallsPanel
            v-if="message.toolCalls && message.toolCalls.length > 0"
            :tool-calls="message.toolCalls"
          />
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="messages.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p class="empty-title">开始对话</p>
      <p class="empty-desc">输入消息与 Agent 交流</p>
    </div>
  </div>
</template>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.message {
  display: flex;
  gap: 0.75rem;
  animation: bubbleIn var(--transition-slow);
}

.message-user {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

.message-assistant {
  justify-content: flex-start;
}

.message-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  flex-shrink: 0;
  transition: all var(--transition-normal);
}

.avatar-user {
  color: var(--gold-primary);
  background: var(--gold-dim);
  border: 1px solid rgba(212, 175, 55, 0.3);
  box-shadow: var(--glow-gold);
}

.message:hover .avatar-user {
  box-shadow: var(--glow-gold-strong);
  transform: scale(1.05);
}

.avatar-assistant,
.avatar-system {
  color: var(--text-primary);
  background: linear-gradient(135deg, var(--amber-dim) 0%, var(--gold-dim) 100%);
  border: 1px solid var(--border-glass);
  box-shadow: var(--glow-amber);
}

.message:hover .avatar-assistant,
.message:hover .avatar-system {
  box-shadow: var(--glow-gold);
}

.message-body {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 75%;
}

.message-user .message-body {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-assistant .message-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.message-user .message-header {
  flex-direction: row-reverse;
}

.message-role {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary);
}

.message-time {
  font-size: 0.6875rem;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.message-user .message-content-wrapper {
  align-items: flex-end;
}

.message-content {
  display: inline-block;
  padding: 0.875rem 1rem;
  line-height: 1.6;
  word-wrap: break-word;
  max-width: 100%;
  position: relative;
}

/* 用户消息 - 渐变边框效果 */
.message-user .message-content {
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(13, 13, 13, 0.9) 100%);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg);
  position: relative;
}

/* 金色渐变边框 - 用户消息 */
.message-user .message-content::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, var(--gold-primary) 0%, var(--gold-dark) 50%, var(--gold-light) 100%);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.7;
  animation: gradientBorder 3s ease infinite;
  background-size: 200% 200%;
}

.message-user .message-content::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  pointer-events: none;
}

/* 助手消息 - 渐变边框效果 */
.message-assistant .message-content {
  background: linear-gradient(135deg, rgba(26, 26, 26, 0.95) 0%, rgba(13, 13, 13, 0.9) 100%);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm);
  position: relative;
}

/* 柔和金色渐变边框 - 助手消息 */
.message-assistant .message-content::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.5) 0%, rgba(245, 158, 11, 0.3) 50%, rgba(212, 175, 55, 0.5) 100%);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.5;
  animation: gradientBorder 4s ease infinite;
  background-size: 200% 200%;
}

.message-assistant .message-content::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 8px 32px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

/* 悬停效果 */
.message:hover .message-content::before {
  opacity: 1;
}

/* Markdown 样式 */
:deep(h1), :deep(h2), :deep(h3) {
  margin: 1em 0 0.5em;
  color: var(--gold-light);
  font-weight: 600;
  line-height: 1.3;
}

:deep(h1) { font-size: 1.5em; }
:deep(h2) { font-size: 1.25em; }
:deep(h3) { font-size: 1.1em; }

:deep(p) {
  margin: 0.5em 0;
}

:deep(p:first-child) {
  margin-top: 0;
}

:deep(p:last-child) {
  margin-bottom: 0;
}

:deep(code) {
  font-family: var(--font-mono);
  padding: 0.15em 0.4em;
  border-radius: var(--radius-sm);
  background: var(--gold-dim);
  color: var(--gold-light);
  font-size: 0.875em;
}

:deep(pre) {
  padding: 1em;
  border-radius: var(--radius);
  background: rgba(5, 5, 5, 0.9);
  border: 1px solid var(--border-glass);
  overflow-x: auto;
  margin: 0.75em 0;
}

:deep(pre code) {
  padding: 0;
  background: none;
  color: var(--text-primary);
}

:deep(a) {
  color: var(--gold-primary);
  text-decoration: none;
}

:deep(a:hover) {
  text-decoration: underline;
  text-shadow: var(--glow-gold);
}

:deep(blockquote) {
  padding: 0.5em 1em;
  margin: 0.5em 0;
  border-left: 3px solid var(--gold-primary);
  background: var(--gold-dim);
  color: var(--text-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

:deep(ul), :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

:deep(li) {
  margin: 0.25em 0;
}

:deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
  font-size: 0.875em;
}

:deep(th), :deep(td) {
  padding: 0.5em 0.75em;
  border: 1px solid var(--border-glass);
  text-align: left;
}

:deep(th) {
  background: var(--gold-dim);
  font-weight: 500;
  color: var(--gold-primary);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  color: var(--gold-primary);
  margin-bottom: 1rem;
  filter: drop-shadow(var(--glow-gold));
  opacity: 0.6;
}

.empty-title {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.empty-desc {
  font-size: 0.875rem;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .message-avatar {
    width: 28px;
    height: 28px;
  }

  .message-content {
    padding: 0.75rem;
  }
}
</style>