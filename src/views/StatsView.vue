<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { DayStat, AllStats } from '@/types'
import { useAgentStore } from '@/stores/agent'

const route = useRoute()
const router = useRouter()
const agentStore = useAgentStore()

// Current agent ID from query param
const agentId = computed(() => route.query.agent as string || '')

// Current agent info
const currentAgent = computed(() => {
  return agentStore.agents.find(a => a.id === agentId.value)
})

// Stats state
const stats = ref<AllStats | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// Time range
type TimeRange = 'daily' | 'weekly' | 'monthly'
const range = ref<TimeRange>('daily')

// Current data based on range
const currentData = computed(() => {
  if (!stats.value) return []
  return stats.value[range.value] || []
})

// Totals
const totalInput = computed(() => currentData.value.reduce((s, d) => s + d.inputTokens, 0))
const totalOutput = computed(() => currentData.value.reduce((s, d) => s + d.outputTokens, 0))
const totalMessages = computed(() => currentData.value.reduce((s, d) => s + d.messageCount, 0))

// Format functions
function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function formatMs(ms: number): string {
  if (!ms) return '-'
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

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

// Fetch stats
async function fetchStats() {
  if (!agentId.value) return

  loading.value = true
  error.value = null

  try {
    const res = await fetch(`/api/stats/${agentId.value}`)
    const data = await res.json()
    if (data.error) {
      error.value = data.error
    } else {
      stats.value = { daily: data.daily, weekly: data.weekly, monthly: data.monthly }
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// Select agent
function selectAgent(id: string) {
  router.push({ path: '/stats', query: { agent: id } })
}

// Go back to agent list
function goBack() {
  router.push('/stats')
}

// Go to sessions
function goToSessions() {
  router.push({ path: '/sessions', query: { agent: agentId.value } })
}

// Watch agent ID changes
watch(agentId, () => {
  if (agentId.value) {
    fetchStats()
  } else {
    stats.value = null
    loading.value = false
  }
}, { immediate: true })

// Initialize
onMounted(async () => {
  if (!agentStore.agents.length) {
    await agentStore.refresh(false)
  }
})

// Bar Chart Component
interface BarConfig {
  key: keyof DayStat
  color: string
  label: string
}

function renderBarChart(data: DayStat[], bars: BarConfig[], height = 220): string {
  if (data.length === 0) return ''

  const padding = { top: 20, right: 20, bottom: 60, left: 60 }
  const width = Math.max(600, data.length * (bars.length * 24 + 16) + padding.left + padding.right)
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  let maxVal = 0
  for (const d of data) {
    for (const b of bars) {
      const v = d[b.key] as number
      if (v > maxVal) maxVal = v
    }
  }
  if (maxVal === 0) maxVal = 1

  const tickCount = 4
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((maxVal / tickCount) * i))
  const groupWidth = chartW / data.length
  const barWidth = Math.min(20, (groupWidth - 8) / bars.length)

  let svg = ''

  // Y axis ticks
  for (const tick of ticks) {
    const y = padding.top + chartH - (tick / maxVal) * chartH
    svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="currentColor" opacity="0.15" />`
    svg += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="currentColor">${formatTokens(tick)}</text>`
  }

  // Bars
  for (let i = 0; i < data.length; i++) {
    const d = data[i]
    const groupX = padding.left + i * groupWidth

    for (let bi = 0; bi < bars.length; bi++) {
      const b = bars[bi]
      const v = d[b.key] as number
      const barH = (v / maxVal) * chartH
      const x = groupX + (groupWidth - bars.length * barWidth) / 2 + bi * barWidth
      const y = padding.top + chartH - barH
      svg += `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barH}" fill="${b.color}" rx="2" opacity="0.85"><title>${b.label}: ${formatTokens(v)}</title></rect>`
    }

    // X axis label
    svg += `<text x="${groupX + groupWidth / 2}" y="${height - padding.bottom + 16}" text-anchor="middle" font-size="10" fill="currentColor" transform="rotate(-30, ${groupX + groupWidth / 2}, ${height - padding.bottom + 16})">${d.date}</text>`
  }

  // Axes
  svg += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartH}" stroke="currentColor" opacity="0.3" />`
  svg += `<line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="currentColor" opacity="0.3" />`

  return `<svg width="${width}" height="${height}" class="chart-svg">${svg}</svg>`
}

// Response Time Chart
function renderResponseTimeChart(data: DayStat[], height = 220): string {
  const filtered = data.filter(d => d.avgResponseMs > 0)
  if (filtered.length === 0) return ''

  const padding = { top: 20, right: 20, bottom: 60, left: 60 }
  const width = Math.max(600, filtered.length * 40 + padding.left + padding.right)
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const maxVal = Math.max(...filtered.map(d => d.avgResponseMs))
  const barWidth = Math.min(28, chartW / filtered.length - 8)

  const tickCount = 4
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((maxVal / tickCount) * i))

  let svg = ''

  // Y axis ticks
  for (const tick of ticks) {
    const y = padding.top + chartH - (tick / maxVal) * chartH
    svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="currentColor" opacity="0.15" />`
    svg += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="currentColor">${formatMs(tick)}</text>`
  }

  // Bars
  for (let i = 0; i < filtered.length; i++) {
    const d = filtered[i]
    const groupW = chartW / filtered.length
    const x = padding.left + i * groupW + (groupW - barWidth) / 2
    const barH = (d.avgResponseMs / maxVal) * chartH
    const y = padding.top + chartH - barH
    svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="#f59e0b" rx="2" opacity="0.85"><title>${d.date}: ${formatMs(d.avgResponseMs)}</title></rect>`
    svg += `<text x="${padding.left + i * groupW + groupW / 2}" y="${height - padding.bottom + 16}" text-anchor="middle" font-size="10" fill="currentColor" transform="rotate(-30, ${padding.left + i * groupW + groupW / 2}, ${height - padding.bottom + 16})">${d.date}</text>`
  }

  // Axes
  svg += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartH}" stroke="currentColor" opacity="0.3" />`
  svg += `<line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="currentColor" opacity="0.3" />`

  return `<svg width="${width}" height="${height}" class="chart-svg">${svg}</svg>`
}

// Chart data computed for template
const barChartSvg = computed(() => {
  if (currentData.value.length === 0) return ''
  return renderBarChart(currentData.value, [
    { key: 'inputTokens', color: '#3b82f6', label: 'Input' },
    { key: 'outputTokens', color: '#10b981', label: 'Output' }
  ])
})

const responseTimeChartSvg = computed(() => {
  if (range.value !== 'daily') return ''
  return renderResponseTimeChart(currentData.value)
})

const hasResponseTimeData = computed(() => {
  return currentData.value.some(d => d.avgResponseMs > 0)
})
</script>

<template>
  <div class="stats-view">
    <!-- Agent Picker View -->
    <template v-if="!agentId">
      <div class="view-header">
        <h1>📊 Stats</h1>
        <p class="subtitle">选择一个 Agent 查看统计数据</p>
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
              <span class="stat-value">{{ formatTokens(agent.session.totalTokens) }}</span>
            </div>
            <div v-if="agent.session.lastActive" class="stat-row">
              <span class="stat-label">最后活跃</span>
              <span class="stat-value">{{ formatTimeAgo(agent.session.lastActive) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Stats Detail View -->
    <template v-else>
      <div class="view-header">
        <div class="header-left">
          <h1>📊 {{ currentAgent?.name || agentId }} Stats</h1>
          <p class="subtitle">Token 消耗与响应时间统计</p>
        </div>
        <div class="header-actions">
          <!-- Time range selector -->
          <div class="range-selector">
            <button
              v-for="r in (['daily', 'weekly', 'monthly'] as TimeRange[])"
              :key="r"
              class="range-btn"
              :class="{ active: range === r }"
              @click="range = r"
            >
              {{ r === 'daily' ? '日' : r === 'weekly' ? '周' : '月' }}
            </button>
          </div>
          <button class="action-btn" @click="goToSessions">
            会话列表
          </button>
          <button class="action-btn" @click="goBack">
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
        <button class="retry-btn" @click="fetchStats">重试</button>
      </div>

      <!-- Stats content -->
      <template v-else-if="stats">
        <!-- Summary cards -->
        <div class="summary-cards">
          <div class="summary-card">
            <div class="card-label">输入 Token</div>
            <div class="card-value input">{{ formatTokens(totalInput) }}</div>
          </div>
          <div class="summary-card">
            <div class="card-label">输出 Token</div>
            <div class="card-value output">{{ formatTokens(totalOutput) }}</div>
          </div>
          <div class="summary-card">
            <div class="card-label">消息数</div>
            <div class="card-value messages">{{ totalMessages }}</div>
          </div>
          <div class="summary-card">
            <div class="card-label">数据周期</div>
            <div class="card-value">{{ currentData.length }}</div>
          </div>
        </div>

        <!-- Token chart -->
        <div class="chart-card">
          <div class="chart-header">
            <h2>Token 消耗</h2>
            <div class="legend">
              <span class="legend-item">
                <span class="legend-color input"></span>
                Input
              </span>
              <span class="legend-item">
                <span class="legend-color output"></span>
                Output
              </span>
            </div>
          </div>
          <div v-if="currentData.length > 0" class="chart-container" v-html="barChartSvg"></div>
          <div v-else class="no-data">暂无数据</div>
        </div>

        <!-- Response time chart (daily only) -->
        <div v-if="range === 'daily'" class="chart-card">
          <div class="chart-header">
            <h2>平均响应时间</h2>
          </div>
          <div v-if="hasResponseTimeData" class="chart-container" v-html="responseTimeChartSvg"></div>
          <div v-else class="no-data">暂无响应时间数据</div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.stats-view {
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
  flex-wrap: wrap;
}

.range-selector {
  display: flex;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-glass);
  overflow: hidden;
}

.range-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.range-btn:hover {
  color: var(--text-primary);
}

.range-btn.active {
  background: var(--bio-cyan);
  color: var(--abyss-black);
  font-weight: 500;
}

.action-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.action-btn:hover {
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

/* Summary Cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 768px) {
  .summary-cards {
    grid-template-columns: repeat(4, 1fr);
  }
}

.summary-card {
  padding: 1.25rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
}

.card-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.card-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.card-value.input {
  color: #60a5fa;
}

.card-value.output {
  color: #34d399;
}

.card-value.messages {
  color: #c084fc;
}

/* Chart Card */
.chart-card {
  padding: 1.5rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  margin-bottom: 1.5rem;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.chart-header h2 {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.legend {
  display: flex;
  gap: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.legend-color {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 2px;
}

.legend-color.input {
  background: #3b82f6;
}

.legend-color.output {
  background: #10b981;
}

.chart-container {
  overflow-x: auto;
}

.chart-svg {
  color: var(--text-muted);
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 10rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* States */
.loading-state,
.error-state {
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
  .stats-view {
    padding: 1rem;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>