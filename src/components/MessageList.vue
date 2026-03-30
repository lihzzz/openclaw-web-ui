<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import type { Message } from '@/stores/chat'
import { renderMarkdown } from '@/utils/markdown'
import { createStoreLogger } from '@/utils/logger'
import ToolCallsPanel from './ToolCallsPanel.vue'

const logger = createStoreLogger('MessageList')

const props = defineProps<{
  messages: Message[]
}>()

// 复制状态
const copiedId = ref<string | null>(null)

// Markdown 渲染缓存 - 使用 Map 存储已渲染的内容
const markdownCache = shallowRef<Map<string, string>>(new Map())

// 获取带缓存的 Markdown 渲染结果
function getRenderedMarkdown(content: string, messageId: string): string {
  const cache = markdownCache.value
  // 使用消息内容 hash 作为缓存 key，避免重复渲染相同内容
  const cacheKey = `${messageId}:${content.length}:${content.slice(0, 50)}`

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }

  const rendered = renderMarkdown(content)

  // 限制缓存大小，避免内存泄漏
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value
    if (firstKey) {
      cache.delete(firstKey)
    }
  }

  cache.set(cacheKey, rendered)
  return rendered
}

// 按时间排序的消息 - 只在消息数量变化时重新计算
const sortedMessages = computed(() => {
  // 消息数组已经是按时间顺序添加的，如果最后一条消息的时间戳 >= 前一条，则无需排序
  const msgs = props.messages
  if (msgs.length < 2) return msgs

  // 检查是否需要排序（检测逆序）
  let needsSort = false
  for (let i = 1; i < msgs.length; i++) {
    if (msgs[i].timestamp < msgs[i - 1].timestamp) {
      needsSort = true
      break
    }
  }

  if (!needsSort) return msgs

  // 只有在需要时才进行排序
  logger.debug('Sorting messages due to out-of-order timestamps')
  return [...msgs].sort((a, b) => a.timestamp - b.timestamp)
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

// 复制消息内容
async function copyMessage(message: Message): Promise<void> {
  try {
    await navigator.clipboard.writeText(message.content)
    copiedId.value = message.id
    setTimeout(() => {
      copiedId.value = null
    }, 2000)
  } catch (err) {
    logger.error('复制失败:', err)
  }
}

// 格式化思考内容长度
function formatThinkingLength(thinking: string): string {
  const len = thinking.length
  if (len < 1000) return `${len} 字符`
  if (len < 10000) return `${(len / 1000).toFixed(1)}K 字符`
  return `${(len / 10000).toFixed(1)}万字符`
}
</script>

<template>
  <div class="message-list">
    <div
      v-for="(message, index) in sortedMessages"
      :key="message.id"
      v-memo="[message.content, message.thinking, message.toolCalls?.length, copiedId === message.id]"
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
          <!-- 思考内容折叠区域 -->
          <details v-if="message.thinking" class="thinking-block">
            <summary class="thinking-summary">
              <span class="thinking-icon">💭</span>
              <span class="thinking-label">思考过程</span>
              <span class="thinking-length">({{ formatThinkingLength(message.thinking) }})</span>
            </summary>
            <div class="thinking-content">
              {{ message.thinking }}
            </div>
          </details>

          <div
            class="message-content"
            v-html="getRenderedMarkdown(message.content, message.id)"
          />

          <!-- 复制按钮 -->
          <button
            class="copy-btn"
            :class="{ copied: copiedId === message.id }"
            @click="copyMessage(message)"
            :title="copiedId === message.id ? '已复制' : '复制'"
          >
            <svg v-if="copiedId !== message.id" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>

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
  gap: 1.5rem;
}

.message {
  display: flex;
  gap: 0.875rem;
  animation: bubbleIn var(--transition-slow);
}

.message-user {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

.message-assistant {
  justify-content: flex-start;
  margin-left: 0;
}

.message-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius);
  flex-shrink: 0;
  transition: all var(--transition-normal);
}

.avatar-user {
  color: var(--bg-primary);
  background: var(--accent);
  border: 1px solid var(--accent);
  box-shadow: var(--glow-accent);
}

.message:hover .avatar-user {
  box-shadow: var(--glow-accent-strong);
  transform: scale(1.05);
}

.avatar-assistant,
.avatar-system {
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
}

.message-body {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
}

.message-user .message-body {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: 85%;
}

.message-assistant .message-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1 1 auto;
  max-width: 90%;
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
  font-weight: 600;
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
  position: relative;
}

.message-user .message-content-wrapper {
  align-items: flex-end;
}

.message-content {
  display: inline-block;
  padding: 1rem 1.25rem;
  line-height: 1.7;
  word-wrap: break-word;
  max-width: 100%;
  position: relative;
  user-select: text;
  -webkit-user-select: text;
  box-shadow: var(--shadow-sm);
}

/* 复制按钮 */
.copy-btn {
  position: absolute;
  top: 0.5rem;
  right: -2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition-fast);
  z-index: 10;
}

.message:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.copy-btn.copied {
  background: var(--success-dim);
  border-color: var(--success);
  color: var(--success);
  opacity: 1;
}

/* 用户消息的复制按钮位置 */
.message-user .copy-btn {
  right: auto;
  left: -2.5rem;
}

/* 思考内容折叠样式 */
.thinking-block {
  margin-bottom: 0.5rem;
  font-size: 0.8125rem;
}

.thinking-summary {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: rgba(138, 180, 248, 0.08);
  border: 1px solid rgba(138, 180, 248, 0.2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  transition: all var(--transition-fast);
  list-style: none;
}

.thinking-summary::-webkit-details-marker {
  display: none;
}

.thinking-summary::before {
  content: '▸';
  font-size: 0.625rem;
  color: rgba(138, 180, 248, 0.6);
  transition: transform var(--transition-fast);
}

.thinking-block[open] .thinking-summary::before {
  transform: rotate(90deg);
}

.thinking-summary:hover {
  background: rgba(138, 180, 248, 0.12);
  border-color: rgba(138, 180, 248, 0.3);
}

.thinking-icon {
  font-size: 0.875rem;
}

.thinking-label {
  color: rgba(138, 180, 248, 0.9);
  font-style: italic;
}

.thinking-length {
  color: rgba(138, 180, 248, 0.5);
  font-size: 0.75rem;
}

.thinking-content {
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-left: 2px solid rgba(138, 180, 248, 0.3);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  font-family: var(--font-mono);
}

/* 用户消息 - 强调色背景 */
.message-user .message-content {
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg);
  border: 1px solid var(--accent);
}

.message-user .message-content :deep(a) {
  color: var(--bg-primary);
  text-decoration: underline;
}

.message-user .message-content :deep(code) {
  background: rgba(0, 0, 0, 0.2);
  color: var(--bg-primary);
}

/* 助手消息 - 次级背景 */
.message-assistant .message-content {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm);
  border: 1px solid var(--border-subtle);
}

/* 悬停效果 */
.message:hover .message-content {
  box-shadow: var(--shadow-md);
}

/* Markdown 样式 */
:deep(h1), :deep(h2), :deep(h3) {
  margin: 1em 0 0.5em;
  color: var(--accent);
  font-weight: 600;
  line-height: 1.3;
  user-select: text;
  -webkit-user-select: text;
}

:deep(h1) { font-size: 1.5em; }
:deep(h2) { font-size: 1.25em; }
:deep(h3) { font-size: 1.1em; }

:deep(p) {
  margin: 0.5em 0;
  user-select: text;
  -webkit-user-select: text;
}

:deep(p:first-child) { margin-top: 0; }
:deep(p:last-child) { margin-bottom: 0; }

:deep(code) {
  font-family: var(--font-mono);
  padding: 0.15em 0.4em;
  border-radius: var(--radius-sm);
  background: var(--accent-dim);
  color: var(--accent-light);
  font-size: 0.875em;
  user-select: text;
  -webkit-user-select: text;
}

:deep(pre) {
  padding: 1em;
  border-radius: var(--radius);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  overflow-x: auto;
  margin: 0.75em 0;
  user-select: text;
  -webkit-user-select: text;
}

:deep(pre code) {
  padding: 0;
  background: none;
  color: var(--text-primary);
}

:deep(a) {
  color: var(--accent);
  text-decoration: none;
}

:deep(a:hover) {
  text-decoration: underline;
}

:deep(blockquote) {
  padding: 0.5em 1em;
  margin: 0.5em 0;
  border-left: 3px solid var(--accent);
  background: var(--accent-dim);
  color: var(--text-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  user-select: text;
  -webkit-user-select: text;
}

:deep(ul), :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
  user-select: text;
  -webkit-user-select: text;
}

:deep(li) {
  margin: 0.25em 0;
  user-select: text;
  -webkit-user-select: text;
}

:deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
  font-size: 0.875em;
  user-select: text;
  -webkit-user-select: text;
}

:deep(th), :deep(td) {
  padding: 0.5em 0.75em;
  border: 1px solid var(--border-subtle);
  text-align: left;
  user-select: text;
  -webkit-user-select: text;
}

:deep(th) {
  background: var(--accent-dim);
  font-weight: 500;
  color: var(--accent);
}

:deep(span) {
  user-select: text;
  -webkit-user-select: text;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

.empty-icon {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-title {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.empty-desc {
  font-size: 0.875rem;
  color: var(--text-muted);
}
</style>
