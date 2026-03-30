<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Agent } from '@/types'
import StatusBadge from './StatusBadge.vue'
import ModelBadge from './ModelBadge.vue'
import PlatformBadge from './PlatformBadge.vue'
import MiniSparkline from './MiniSparkline.vue'

const props = defineProps<{
  agent: Agent
  agentState?: string
  testResult?: { ok: boolean; error?: string; text?: string; elapsed: number } | null
  platformTestResults?: Record<string, { ok: boolean; error?: string; elapsed: number } | null>
  sessionTestResult?: { ok: boolean; error?: string; reply?: string; elapsed: number } | null
  dmSessionResults?: Record<string, { ok: boolean; error?: string; elapsed: number } | null>
  modelOptions?: Array<{
    providerId: string
    providerName: string
    accessMode?: 'auth' | 'api_key'
    models: Array<{ id: string; name: string }>
  }>
  onModelChange?: (agentId: string, model: string) => Promise<void>
  compact?: boolean
}>()

// 编辑模型状态
const isEditingModel = ref(false)
const draftModel = ref(props.agent.model)
const isSavingModel = ref(false)
const modelSaveError = ref<string | null>(null)

// 监听 agent.model 变化
watch(() => props.agent.model, (newModel) => {
  if (!isEditingModel.value) {
    draftModel.value = newModel
    modelSaveError.value = null
  }
})

// 是否可以切换模型
const canSwitchModel = computed(() => {
  return props.onModelChange && props.modelOptions && props.modelOptions.length > 0
})

// 格式化 token 数量
function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

// 格式化响应时间
function formatMs(ms: number): string {
  if (!ms) return '-'
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

// 格式化时间
function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)

  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`

  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

// 保存模型
async function handleModelSave(): Promise<void> {
  if (!props.onModelChange || !draftModel.value || draftModel.value === props.agent.model) return

  isSavingModel.value = true
  modelSaveError.value = null

  try {
    await props.onModelChange(props.agent.id, draftModel.value)
    isEditingModel.value = false
  } catch (e) {
    modelSaveError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    isSavingModel.value = false
  }
}

// 取消编辑
function cancelEdit(): void {
  draftModel.value = props.agent.model
  modelSaveError.value = null
  isEditingModel.value = false
}

// 响应时间颜色
const responseTimeColor = computed(() => {
  const val = props.agent.session?.todayAvgResponseMs
  if (!val) return 'text-muted'
  if (val > 50000) return 'text-error'
  if (val > 30000) return 'text-warning'
  return 'text-success'
})
</script>

<template>
  <div class="agent-card" :class="{ compact: compact }">
    <!-- 头部 -->
    <div class="card-header">
      <span class="agent-emoji">{{ agent.emoji }}</span>
      <div class="agent-info">
        <h3 class="agent-name">
          {{ agent.name }}
          <span class="agent-id">({{ agent.id }})</span>
        </h3>
      </div>
      <StatusBadge :state="agentState" />
    </div>

    <!-- 内容 -->
    <div class="card-content">
      <!-- Agent ID -->
      <div v-if="!compact" class="info-row">
        <span class="info-label">Agent ID</span>
        <div class="info-value">
          <span class="id-badge">{{ agent.id }}</span>

          <!-- 会话测试结果 -->
          <template v-if="sessionTestResult === undefined">
            <span class="test-pending">--</span>
          </template>
          <template v-else-if="sessionTestResult === null">
            <span class="test-loading">⏳</span>
          </template>
          <template v-else-if="sessionTestResult.ok">
            <span class="test-success" :title="`${sessionTestResult.elapsed}ms`">✅</span>
          </template>
          <template v-else>
            <span class="test-error" :title="sessionTestResult.error">❌</span>
          </template>
        </div>
      </div>

      <!-- 模型 -->
      <div class="info-row">
        <span class="info-label">模型</span>
        <div class="info-value model-value">
          <ModelBadge :model="agent.model" />

          <!-- 模型测试结果 -->
          <template v-if="testResult === undefined">
            <span class="test-pending">--</span>
          </template>
          <template v-else-if="testResult === null">
            <span class="test-loading">⏳</span>
          </template>
          <template v-else-if="testResult.ok">
            <span class="test-success" :title="`${testResult.elapsed}ms${testResult.text ? ' · ' + testResult.text : ''}`">✅</span>
          </template>
          <template v-else>
            <span class="test-error" :title="testResult.error">❌</span>
          </template>

          <!-- 切换模型按钮 -->
          <button
            v-if="canSwitchModel && !isEditingModel"
            class="switch-model-btn"
            @click="isEditingModel = true"
          >
            切换
          </button>
        </div>

        <!-- 模型选择器 -->
        <div v-if="canSwitchModel && isEditingModel" class="model-selector">
          <select v-model="draftModel" :disabled="isSavingModel" class="model-select">
            <option
              v-for="group in modelOptions"
              :key="group.providerId"
              :label="group.providerName"
            >
              <option
                v-for="model in group.models"
                :key="`${group.providerId}/${model.id}`"
                :value="`${group.providerId}/${model.id}`"
              >
                {{ group.providerId }} / {{ model.name || model.id }}
              </option>
            </option>
          </select>

          <div class="model-actions">
            <button
              class="save-btn"
              :disabled="isSavingModel || !draftModel || draftModel === agent.model"
              @click="handleModelSave"
            >
              {{ isSavingModel ? '保存中...' : '保存' }}
            </button>
            <button class="cancel-btn" :disabled="isSavingModel" @click="cancelEdit">
              取消
            </button>
          </div>

          <p class="model-hint">切换后将在下次对话生效</p>

          <p v-if="modelSaveError" class="model-error">{{ modelSaveError }}</p>
        </div>
      </div>

      <!-- 平台 -->
      <div v-if="!compact" class="info-row">
        <span class="info-label">平台</span>
        <div class="platforms-list">
          <PlatformBadge
            v-for="(platform, i) in agent.platforms"
            :key="i"
            :platform="platform"
            :agent-id="agent.id"
            :test-result="platformTestResults ? platformTestResults[`${agent.id}:${platform.name}`] : undefined"
          />
        </div>
      </div>

      <!-- 会话统计 -->
      <template v-if="agent.session && !compact">
        <div class="session-stats">
          <!-- 会话数量 -->
          <div class="stat-row">
            <span class="stat-label">会话数</span>
            <span class="stat-value">{{ agent.session.sessionCount }}</span>
          </div>

          <!-- 消息数 -->
          <div class="stat-row">
            <span class="stat-label">消息数</span>
            <span class="stat-value">{{ agent.session.messageCount }}</span>
          </div>

          <!-- Token 使用 -->
          <div class="stat-row">
            <span class="stat-label">Token</span>
            <MiniSparkline
              v-if="agent.session.weeklyTokens"
              :data="agent.session.weeklyTokens"
              color="#d4af37"
            />
            <span class="stat-value" :title="'总计 Token'">
              {{ formatTokens(agent.session.totalTokens) }}
            </span>
          </div>

          <!-- 最近活跃 -->
          <div v-if="agent.session.lastActive" class="stat-row">
            <span class="stat-label">最近活跃</span>
            <span class="stat-value">{{ formatTimeAgo(agent.session.lastActive) }}</span>
          </div>

          <!-- 今日平均响应 -->
          <div class="stat-row">
            <span class="stat-label">今日响应</span>
            <MiniSparkline
              v-if="agent.session.weeklyResponseMs"
              :data="agent.session.weeklyResponseMs"
            />
            <span class="stat-value" :class="responseTimeColor">
              {{ formatMs(agent.session.todayAvgResponseMs) }}
            </span>
          </div>
        </div>
      </template>

      <!-- 紧凑模式简化统计 -->
      <template v-if="agent.session && compact">
        <div class="compact-stats">
          <span class="compact-stat" title="会话数">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 2h10v2H4V2zM2 4h14v2H2V4zM2 6h16v12H2V6z"/>
            </svg>
            {{ agent.session.sessionCount }}
          </span>
          <span class="compact-stat" title="Token">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            {{ formatTokens(agent.session.totalTokens) }}
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.agent-card {
  border-radius: var(--radius);
  border: 1px solid var(--border-glass);
  background: rgba(13, 13, 13, 0.75);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  padding: 0.75rem;
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
}

/* 悬停时的光晕扩散效果 */
.agent-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
              var(--gold-dim) 0%, transparent 50%);
  opacity: 0;
  transition: opacity var(--transition-normal);
  pointer-events: none;
}

.agent-card:hover {
  border-color: var(--gold-primary);
  box-shadow: var(--glow-gold);
  transform: translateY(-2px);
}

.agent-card:hover::before {
  opacity: 1;
}

/* 紧凑模式 */
.agent-card.compact {
  padding: 0.5rem;
  background: rgba(13, 13, 13, 0.5);
}

.agent-card.compact .card-header {
  margin-bottom: 0.5rem;
}

.agent-card.compact .agent-emoji {
  font-size: 1rem;
}

.agent-card.compact .agent-name {
  font-size: 0.8125rem;
}

.agent-card.compact .info-row {
  gap: 0.125rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  position: relative;
  z-index: 1;
}

.agent-emoji {
  font-size: 1.25rem;
  transition: transform var(--transition-normal);
}

.agent-card:hover .agent-emoji {
  transform: scale(1.15) rotate(5deg);
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  transition: color var(--transition-fast);
}

.agent-card:hover .agent-name {
  color: var(--gold-light);
}

.agent-id {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.625rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.id-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--gold-dim);
  color: var(--gold-primary);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 9999px;
  transition: all var(--transition-fast);
}

.agent-card:hover .id-badge {
  background: rgba(212, 175, 55, 0.25);
  border-color: var(--gold-primary);
  box-shadow: 0 0 10px var(--gold-glow);
}

.test-pending {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.test-loading {
  animation: pulse 1s ease-in-out infinite;
}

.test-success {
  font-size: 0.875rem;
  color: var(--success);
  cursor: help;
}

.test-error {
  font-size: 0.875rem;
  color: var(--error);
  cursor: help;
}

.model-value {
  flex-wrap: wrap;
}

.switch-model-btn {
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border-glass);
  border-radius: 9999px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.switch-model-btn:hover {
  color: var(--gold-primary);
  border-color: var(--gold-primary);
  box-shadow: 0 0 8px var(--gold-glow);
}

.model-selector {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--ocean-dark);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}

.model-select {
  width: 100%;
  padding: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-primary);
  background: var(--ocean-mid);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}

.model-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.save-btn {
  flex: 1;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--abyss-black);
  background: var(--gold-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.save-btn:hover:not(:disabled) {
  background: var(--gold-light);
  box-shadow: var(--glow-gold);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.cancel-btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--gold-primary);
}

.model-hint {
  margin-top: 0.5rem;
  font-size: 0.625rem;
  color: var(--text-muted);
}

.model-error {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--error);
}

.platforms-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.session-stats {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-subtle);
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
}

.stat-label {
  color: var(--text-muted);
}

.stat-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
}

/* 紧凑模式统计 */
.compact-stats {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.compact-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.compact-stat svg {
  opacity: 0.6;
}

.text-muted {
  color: var(--text-muted);
}

.text-warning {
  color: var(--warning);
}

.text-error {
  color: var(--error);
}

.text-success {
  color: var(--success);
}
</style>
