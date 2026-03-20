<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Session, SessionTestStatus } from '@/types'
import { useAgentStore } from '@/stores/agent'

const route = useRoute()
const router = useRouter()
const agentStore = useAgentStore()

// Session type styling
const TYPE_INFO: Record<string, { emoji: string; color: string }> = {
  main: { emoji: '🏠', color: 'green' },
  'feishu-dm': { emoji: '📱', color: 'blue' },
  'feishu-group': { emoji: '👥', color: 'blue' },
  'discord-dm': { emoji: '🎮', color: 'purple' },
  'discord-channel': { emoji: '📢', color: 'purple' },
  'telegram-dm': { emoji: '💬', color: 'cyan' },
  'telegram-group': { emoji: '👥', color: 'cyan' },
  'telegram-slash': { emoji: '⚡', color: 'cyan' },
  telegram: { emoji: '📱', color: 'cyan' },
  'whatsapp-dm': { emoji: '💬', color: 'green' },
  'whatsapp-group': { emoji: '👥', color: 'green' },
  'qqbot-dm': { emoji: '💬', color: 'red' },
  'qqbot-group': { emoji: '👥', color: 'red' },
  cron: { emoji: '⏰', color: 'yellow' },
  api: { emoji: '🔌', color: 'blue' },
  unknown: { emoji: '❓', color: 'gray' }
}

// Sessions state
const sessions = ref<Session[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const testResults = ref<Record<string, SessionTestStatus>>({})
const testingAll = ref(false)

// Current agent ID from query param
const agentId = computed(() => route.query.agent as string || '')

// Current agent info
const currentAgent = computed(() => {
  return agentStore.agents.find(a => a.id === agentId.value)
})

// Total tokens
const totalTokens = computed(() => {
  return sessions.value.reduce((sum, s) => sum + s.totalTokens, 0)
})

// Format time ago
function formatTimeAgo(ts: number): string {
  if (!ts) return '-'
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

// Format datetime
function formatTime(ts: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

// Get type info
function getTypeInfo(type: string) {
  return TYPE_INFO[type] || TYPE_INFO.unknown
}

// Get type label
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    main: '主会话',
    'feishu-dm': '飞书私信',
    'feishu-group': '飞书群聊',
    'discord-dm': 'Discord私信',
    'discord-channel': 'Discord频道',
    'telegram-dm': 'Telegram私信',
    'telegram-group': 'Telegram群聊',
    'telegram-slash': 'Telegram命令',
    telegram: 'Telegram',
    'whatsapp-dm': 'WhatsApp私信',
    'whatsapp-group': 'WhatsApp群聊',
    'qqbot-dm': 'QQ私信',
    'qqbot-group': 'QQ群聊',
    cron: '定时任务',
    api: 'API会话',
    unknown: '未知'
  }
  return labels[type] || type
}

// Build gateway URL
function buildGatewayUrl(sessionKey: string): string {
  const gateway = agentStore.gateway
  const host = gateway.host || '127.0.0.1'
  let url = `http://${host}:${gateway.port}/chat?session=${encodeURIComponent(sessionKey)}`
  if (gateway.token) {
    url += `&token=${encodeURIComponent(gateway.token)}`
  }
  return url
}

// Fetch sessions
async function fetchSessions() {
  if (!agentId.value) return

  loading.value = true
  error.value = null

  try {
    const res = await fetch(`/api/sessions/${agentId.value}`)
    const data = await res.json()
    if (data.error) {
      error.value = data.error
    } else {
      sessions.value = data.sessions || []
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Test single session
async function testSession(sessionKey: string, event?: Event) {
  event?.stopPropagation()
  testResults.value[sessionKey] = { status: 'testing' }

  try {
    const res = await fetch('/api/test-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionKey,
        agentId: agentId.value
      })
    })
    const data = await res.json()
    testResults.value[sessionKey] = {
      status: data.status === 'ok' ? 'ok' : 'error',
      elapsed: data.elapsed,
      reply: data.reply,
      error: data.error
    }
  } catch (e: any) {
    testResults.value[sessionKey] = {
      status: 'error',
      error: e.message
    }
  }
}

// Test all sessions
async function testAllSessions() {
  testingAll.value = true
  await Promise.all(sessions.value.map(s => testSession(s.key)))
  testingAll.value = false
}

// Open chat
function openChat(sessionKey: string) {
  window.open(buildGatewayUrl(sessionKey), '_blank')
}

// Select agent
function selectAgent(id: string) {
  router.push({ path: '/sessions', query: { agent: id } })
}

// Go back to agent list
function goBack() {
  router.push('/sessions')
}

// Load test results from localStorage
function loadTestResults() {
  try {
    const saved = localStorage.getItem('sessionTestResults')
    if (saved) {
      testResults.value = JSON.parse(saved)
    }
  } catch (e) {
    console.error('Failed to load test results from localStorage', e)
  }
}

// Save test results to localStorage
function saveTestResults() {
  if (Object.keys(testResults.value).length > 0) {
    localStorage.setItem('sessionTestResults', JSON.stringify(testResults.value))
  }
}

// Watch agent ID changes
watch(agentId, () => {
  if (agentId.value) {
    fetchSessions()
  } else {
    sessions.value = []
    loading.value = false
  }
}, { immediate: true })

// Watch test results changes
watch(testResults, saveTestResults, { deep: true })

// Initialize
onMounted(async () => {
  loadTestResults()
  if (!agentStore.agents.length) {
    await agentStore.refresh(false)
  }
})
</script>

<template>
  <div class="sessions-view">
    <!-- Agent Picker View -->
    <template v-if="!agentId">
      <div class="view-header">
        <h1>💬 Sessions</h1>
        <p class="subtitle">选择一个 Agent 查看其会话列表</p>
      </div>

      <!-- Loading state -->
      <div v-if="agentStore.loading" class="loading-state">
        <p>加载中...</p>
      </div>

      <!-- Error state -->
      <div v-else-if="agentStore.error" class="error-state">
        <p class="error-text">加载失败: {{ agentStore.error }}</p>
      </div>

      <!-- Agent grid -->
      <div v-else class="agents-grid">
        <div
          v-for="agent in agentStore.agents"
          :key="agent.id"
          class="agent-card"
          @click="selectAgent(agent.id)"
        >
          <div class="agent-header">
            <span class="agent-emoji">{{ agent.emoji }}</span>
            <div class="agent-info">
              <h3>{{ agent.name }}</h3>
              <span v-if="agent.name !== agent.id" class="agent-id">{{ agent.id }}</span>
            </div>
          </div>
          <div v-if="agent.session" class="agent-stats">
            <div class="stat-row">
              <span class="stat-label">会话数</span>
              <span class="stat-value">{{ agent.session.sessionCount }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Token 用量</span>
              <span class="stat-value">{{ (agent.session.totalTokens / 1000).toFixed(1) }}k</span>
            </div>
            <div v-if="agent.session.lastActive" class="stat-row">
              <span class="stat-label">最后活跃</span>
              <span class="stat-value">{{ formatTimeAgo(agent.session.lastActive) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Session List View -->
    <template v-else>
      <div class="view-header">
        <div class="header-left">
          <h1>📋 {{ currentAgent?.name || agentId }} Sessions</h1>
          <p class="subtitle">
            {{ sessions.length }} 个会话 · 总 Token: {{ (totalTokens / 1000).toFixed(1) }}k
          </p>
        </div>
        <div class="header-actions">
          <button
            class="test-all-btn"
            :disabled="testingAll"
            @click="testAllSessions"
          >
            {{ testingAll ? '测试中...' : '测试全部' }}
          </button>
          <button class="back-btn" @click="goBack">
            返回
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="loading-state">
        <p>加载中...</p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="error-state">
        <p class="error-text">加载失败: {{ error }}</p>
        <button class="retry-btn" @click="fetchSessions">重试</button>
      </div>

      <!-- Empty state -->
      <div v-else-if="sessions.length === 0" class="empty-state">
        <p>暂无会话数据</p>
      </div>

      <!-- Session list -->
      <div v-else class="sessions-list">
        <div
          v-for="session in sessions"
          :key="session.key"
          class="session-card"
          @click="openChat(session.key)"
        >
          <!-- Header -->
          <div class="session-header">
            <div class="session-type-group">
              <span
                class="type-badge"
                :class="getTypeInfo(session.type).color"
              >
                {{ getTypeInfo(session.type).emoji }} {{ getTypeLabel(session.type) }}
              </span>
              <code v-if="session.target" class="target-code">{{ session.target }}</code>
            </div>
            <div class="session-actions">
              <button
                class="test-btn"
                :disabled="testResults[session.key]?.status === 'testing'"
                @click="(e) => testSession(session.key, e)"
              >
                {{ testResults[session.key]?.status === 'testing' ? '测试中' : '测试' }}
              </button>
              <span class="time-ago">{{ formatTimeAgo(session.updatedAt) }}</span>
            </div>
          </div>

          <!-- Test result -->
          <div
            v-if="testResults[session.key] && testResults[session.key].status !== 'testing'"
            class="test-result"
            :class="testResults[session.key].status"
          >
            <span class="result-status">
              {{ testResults[session.key].status === 'ok' ? '✓ 测试通过' : '✗ 测试失败' }}
            </span>
            <span v-if="testResults[session.key].elapsed" class="result-time">
              耗时: {{ (testResults[session.key].elapsed! / 1000).toFixed(1) }}s
            </span>
            <span v-if="testResults[session.key].reply" class="result-reply">
              回复: {{ testResults[session.key].reply }}
            </span>
            <span v-if="testResults[session.key].error" class="result-error">
              {{ testResults[session.key].error }}
            </span>
          </div>

          <!-- Context usage bar -->
          <div v-if="session.contextTokens > 0" class="context-bar">
            <div class="context-label">
              <span>上下文</span>
              <span>
                {{ (session.totalTokens / 1000).toFixed(1) }}k / {{ (session.contextTokens / 1000).toFixed(0) }}k
                ({{ (session.totalTokens / session.contextTokens * 100).toFixed(1) }}%)
              </span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :class="{
                  'high': session.totalTokens / session.contextTokens > 0.9,
                  'medium': session.totalTokens / session.contextTokens > 0.7
                }"
                :style="{ width: `${Math.min(100, session.totalTokens / session.contextTokens * 100)}%` }"
              />
            </div>
          </div>

          <!-- Footer -->
          <div class="session-footer">
            <code class="session-key">{{ session.key }}</code>
            <span class="session-time">{{ formatTime(session.updatedAt) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sessions-view {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

/* Header */
.view-header {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.view-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: 0.375rem;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.test-all-btn {
  padding: 0.625rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: white;
  background: var(--bio-cyan);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.test-all-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.test-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.back-btn {
  padding: 0.625rem 1.25rem;
  font-size: 0.9375rem;
  color: var(--text-primary);
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.back-btn:hover {
  border-color: var(--bio-cyan);
}

/* Agent Grid */
.agents-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

@media (min-width: 768px) {
  .agents-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1200px) {
  .agents-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.agent-card {
  padding: 1.75rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.agent-card:hover {
  border-color: var(--bio-cyan);
}

.agent-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.agent-emoji {
  font-size: 2.5rem;
  line-height: 1;
}

.agent-info h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.agent-id {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.agent-stats {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.stat-label {
  color: var(--text-muted);
}

.stat-value {
  color: var(--text-primary);
  font-weight: 500;
}

/* Session List */
.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.session-card {
  padding: 1.5rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.session-card:hover {
  border-color: var(--bio-cyan);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.session-type-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 9999px;
  border: 1px solid;
}

.type-badge.green {
  background: rgba(34, 197, 94, 0.1);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.3);
}

.type-badge.blue {
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.3);
}

.type-badge.purple {
  background: rgba(168, 85, 247, 0.1);
  color: #d8b4fe;
  border-color: rgba(168, 85, 247, 0.3);
}

.type-badge.cyan {
  background: rgba(6, 182, 212, 0.1);
  color: #67e8f9;
  border-color: rgba(6, 182, 212, 0.3);
}

.type-badge.yellow {
  background: rgba(234, 179, 8, 0.1);
  color: #fde047;
  border-color: rgba(234, 179, 8, 0.3);
}

.type-badge.red {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.3);
}

.type-badge.gray {
  background: rgba(107, 114, 128, 0.1);
  color: #d1d5db;
  border-color: rgba(107, 114, 128, 0.3);
}

.target-code {
  font-size: 0.8125rem;
  color: var(--text-muted);
  background: var(--ocean-dark);
  padding: 0.375rem 0.625rem;
  border-radius: var(--radius-sm);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.test-btn {
  padding: 0.375rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary);
  background: transparent;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.test-btn:hover:not(:disabled) {
  border-color: var(--bio-cyan);
  color: var(--bio-cyan);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.time-ago {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

/* Test Result */
.test-result {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  border-radius: var(--radius-sm);
}

.test-result.ok {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
}

.test-result.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.result-status {
  font-weight: 500;
}

.result-time,
.result-reply,
.result-error {
  margin-left: 0.5rem;
  opacity: 0.8;
}

.result-error {
  word-break: break-all;
}

/* Context Bar */
.context-bar {
  margin-bottom: 1rem;
}

.context-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-bottom: 0.375rem;
}

.progress-bar {
  height: 0.5rem;
  background: var(--ocean-dark);
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #22c55e;
  border-radius: 9999px;
  transition: width 0.3s;
}

.progress-fill.medium {
  background: #eab308;
}

.progress-fill.high {
  background: #ef4444;
}

/* Session Footer */
.session-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.session-key {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  opacity: 0.6;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-time {
  white-space: nowrap;
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.error-text {
  color: var(--error);
  margin-bottom: 1rem;
}

.retry-btn {
  padding: 0.5rem 1.5rem;
  font-size: 0.875rem;
  color: var(--bio-cyan);
  background: rgba(0, 245, 255, 0.1);
  border: 1px solid var(--bio-cyan);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.retry-btn:hover {
  background: rgba(0, 245, 255, 0.2);
}

/* Responsive */
@media (max-width: 768px) {
  .sessions-view {
    padding: 1rem;
  }

  .session-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .session-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>