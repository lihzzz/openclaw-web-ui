<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAgentStore } from '@/stores/agent'
import AgentCard from '@/components/AgentCard.vue'

const agentStore = useAgentStore()

// 刷新间隔选项
const refreshOptions = [
  { label: '手动', value: 0 },
  { label: '10秒', value: 10 },
  { label: '30秒', value: 30 },
  { label: '1分钟', value: 60 },
  { label: '5分钟', value: 300 },
  { label: '10分钟', value: 600 }
]

// 当前刷新间隔
const refreshInterval = ref(0)

// 统计时间范围
const statsRange = ref<'daily' | 'weekly' | 'monthly'>('daily')

// 定时器
let refreshTimer: ReturnType<typeof setInterval> | null = null
let statusTimer: ReturnType<typeof setInterval> | null = null

// 格式化 token
function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

// 手动刷新
async function handleRefresh(): Promise<void> {
  await agentStore.refresh(false)
}

// 切换模型
async function handleModelChange(agentId: string, model: string): Promise<void> {
  await agentStore.setAgentModel(agentId, model)
}

// 监听刷新间隔变化
watch(refreshInterval, (value) => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }

  if (value > 0) {
    refreshTimer = setInterval(() => {
      agentStore.refresh(true)
    }, value * 1000)
  }
})

// 获取当前统计数据
function getCurrentStats() {
  return agentStore.stats?.[statsRange.value] || []
}

// 计算汇总
function getTotals() {
  const data = getCurrentStats()
  return {
    inputTokens: data.reduce((s, d) => s + d.inputTokens, 0),
    outputTokens: data.reduce((s, d) => s + d.outputTokens, 0),
    messages: data.reduce((s, d) => s + d.messageCount, 0)
  }
}

// 初始化
onMounted(async () => {
  await agentStore.refresh(false)
  await agentStore.refreshAgentStatus()

  // 定时刷新状态
  statusTimer = setInterval(() => {
    agentStore.refreshAgentStatus()
  }, 30000)
})

// 清理
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (statusTimer) clearInterval(statusTimer)
})
</script>

<template>
  <div class="agents-view">
    <!-- 头部 -->
    <div class="view-header">
      <div class="header-title">
        <h1>🤖 Bot Overview</h1>
        <p class="subtitle">
          共 {{ agentStore.agents.length }} 个 Agent · 默认模型: {{ agentStore.defaults.model }}
        </p>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="status-indicator" :class="{ connected: !agentStore.error }">
          <span class="dot"></span>
          {{ agentStore.error ? '离线' : '在线' }}
        </span>
      </div>

      <div class="toolbar-right">
        <!-- 刷新间隔 -->
        <select v-model="refreshInterval" class="refresh-select">
          <option v-for="opt in refreshOptions" :key="opt.value" :value="opt.value">
            {{ opt.value === 0 ? '🔄 ' : '⏱️ ' }}{{ opt.label }}
          </option>
        </select>

        <!-- 手动刷新 -->
        <button
          v-if="refreshInterval === 0"
          class="refresh-btn"
          :disabled="agentStore.loading"
          @click="handleRefresh"
        >
          {{ agentStore.loading ? '⏳' : '🔄' }}
        </button>

        <!-- 更新时间 -->
        <span v-if="agentStore.lastUpdated" class="last-updated">
          更新于 {{ agentStore.lastUpdated }}
        </span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="agentStore.loading && !agentStore.agents.length" class="loading-state">
      <p>加载中...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="agentStore.error && !agentStore.agents.length" class="error-state">
      <p class="error-text">加载失败: {{ agentStore.error }}</p>
      <button class="retry-btn" @click="handleRefresh">重试</button>
    </div>

    <!-- Agent 卡片墙 -->
    <div v-else class="agents-grid">
      <AgentCard
        v-for="agent in agentStore.agents"
        :key="agent.id"
        :agent="agent"
        :agent-state="agentStore.getAgentState(agent.id)"
        :gateway-port="agentStore.gateway.port"
        :gateway-token="agentStore.gateway.token"
        :gateway-host="agentStore.gateway.host"
        :model-options="agentStore.providers.map(p => ({
          providerId: p.id,
          providerName: p.id,
          accessMode: p.accessMode,
          models: p.models.map(m => ({ id: m.id, name: m.name || m.id }))
        }))"
        :on-model-change="handleModelChange"
      />
    </div>

    <!-- 统计趋势 -->
    <div v-if="agentStore.stats" class="stats-section">
      <div class="stats-header">
        <h2>📊 统计趋势</h2>
        <div class="range-tabs">
          <button
            v-for="r in ['daily', 'weekly', 'monthly'] as const"
            :key="r"
            class="range-tab"
            :class="{ active: statsRange === r }"
            @click="statsRange = r"
          >
            {{ r === 'daily' ? '日' : r === 'weekly' ? '周' : '月' }}
          </button>
        </div>
      </div>

      <!-- 汇总 -->
      <div class="stats-summary">
        <div class="summary-card">
          <span class="summary-label">输入 Token</span>
          <span class="summary-value blue">{{ formatTokens(getTotals().inputTokens) }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">输出 Token</span>
          <span class="summary-value green">{{ formatTokens(getTotals().outputTokens) }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">消息数</span>
          <span class="summary-value purple">{{ getTotals().messages }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.agents-view {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

/* 头部 */
.view-header {
  margin-bottom: 1rem;
}

.header-title h1 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.status-indicator .dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--error);
}

.status-indicator.connected .dot {
  background: var(--success);
}

.refresh-select {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-primary);
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.refresh-btn {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.refresh-btn:hover:not(:disabled) {
  border-color: var(--bio-cyan);
}

.last-updated {
  font-size: 0.625rem;
  color: var(--text-muted);
  white-space: nowrap;
}

/* 加载和错误状态 */
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
  transition: all var(--transition-fast);
}

.retry-btn:hover {
  background: rgba(0, 245, 255, 0.2);
}

/* Agent 卡片网格 */
.agents-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .agents-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .agents-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* 统计区域 */
.stats-section {
  margin-top: 2rem;
  padding: 1.25rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stats-header h2 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.range-tabs {
  display: flex;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.range-tab {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.range-tab:hover {
  color: var(--text-primary);
}

.range-tab.active {
  background: var(--bio-cyan);
  color: var(--abyss-black);
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .stats-summary {
    grid-template-columns: 1fr;
  }
}

.summary-card {
  padding: 0.75rem;
  background: var(--ocean-dark);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}

.summary-label {
  display: block;
  font-size: 0.625rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.summary-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--font-mono);
}

.summary-value.blue {
  color: #60a5fa;
}

.summary-value.green {
  color: var(--success);
}

.summary-value.purple {
  color: #c084fc;
}

/* 响应式 */
@media (max-width: 768px) {
  .agents-view {
    padding: 1rem;
  }
}
</style>