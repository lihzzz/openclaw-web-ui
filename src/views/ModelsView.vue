<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAgentStore } from '@/stores/agent'
import { fetchModelStats, testModel } from '@/services/agentApi'
import type { ModelStat, ModelTestResult } from '@/types'

const router = useRouter()
const agentStore = useAgentStore()

// 状态
const modelStats = ref<Record<string, ModelStat>>({})
const loading = ref(true)
const error = ref<string | null>(null)
const testing = ref<Record<string, boolean>>({})
const testResults = ref<Record<string, ModelTestResult>>({})

// 计算属性
const providers = computed(() => agentStore.providers)
const defaults = computed(() => agentStore.defaults)

// 格式化函数
function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return String(n)
}

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

// 获取模型统计
function getStat(providerId: string, modelId: string): ModelStat | undefined {
  return modelStats.value[`${providerId}/${modelId}`]
}

// 测试单个模型
async function runTestModel(providerId: string, modelId: string): Promise<void> {
  const key = `${providerId}/${modelId}`
  testing.value[key] = true
  delete testResults.value[key]

  try {
    const result = await testModel(providerId, modelId)
    testResults.value[key] = result
  } catch (e) {
    testResults.value[key] = {
      ok: false,
      elapsed: 0,
      model: key,
      mode: 'unknown',
      status: 'error',
      error: e instanceof Error ? e.message : 'Request failed',
      source: 'direct_model_probe',
      precision: 'model'
    }
  } finally {
    testing.value[key] = false
  }
}

// 测试所有模型
async function runTestAllModels(): Promise<void> {
  const modelTargets: Array<{ providerId: string; modelId: string; key: string }> = []
  const seen = new Set<string>()

  for (const p of providers.value) {
    const modelIds = p.models.length > 0
      ? Array.from(new Set(p.models.map(m => m.id)))
      : Array.from(new Set(
          Object.values(modelStats.value)
            .filter(s => s.provider === p.id)
            .map(s => s.modelId)
        ))

    for (const modelId of modelIds) {
      const key = `${p.id}/${modelId}`
      if (seen.has(key)) continue
      seen.add(key)
      modelTargets.push({ providerId: p.id, modelId, key })
    }
  }

  if (modelTargets.length === 0) return

  // 设置所有为测试中状态
  for (const t of modelTargets) {
    testing.value[t.key] = true
    delete testResults.value[t.key]
  }

  await Promise.all(
    modelTargets.map(async ({ providerId, modelId, key }) => {
      try {
        const result = await testModel(providerId, modelId)
        testResults.value[key] = result
      } catch (e) {
        testResults.value[key] = {
          ok: false,
          elapsed: 0,
          model: key,
          mode: 'unknown',
          status: 'error',
          error: e instanceof Error ? e.message : 'Request failed',
          source: 'direct_model_probe',
          precision: 'model'
        }
      } finally {
        testing.value[key] = false
      }
    })
  )
}

// 检查是否正在测试
function isTestingAny(): boolean {
  return Object.values(testing.value).some(Boolean)
}

// 加载数据
async function loadData(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    // 加载配置（如果还没有）
    if (!agentStore.config) {
      await agentStore.refresh(false)
    }

    // 加载模型统计
    const statsData = await fetchModelStats()
    if (statsData.models) {
      const map: Record<string, ModelStat> = {}
      for (const m of statsData.models) {
        map[`${m.provider}/${m.modelId}`] = m
      }
      modelStats.value = map
    }

    // 从 localStorage 恢复测试结果
    const savedTestResults = localStorage.getItem('modelTestResults')
    if (savedTestResults) {
      try {
        testResults.value = JSON.parse(savedTestResults)
      } catch {
        // ignore
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}

// 返回首页
function goBack(): void {
  router.push('/')
}

// 保存测试结果到 localStorage
function saveTestResults(): void {
  if (Object.keys(testResults.value).length > 0) {
    localStorage.setItem('modelTestResults', JSON.stringify(testResults.value))
  }
}

// 监听测试结果变化
import { watch } from 'vue'
watch(testResults, saveTestResults, { deep: true })

// 初始化
onMounted(loadData)
</script>

<template>
  <div class="models-view">
    <!-- 头部 -->
    <div class="view-header">
      <div class="header-left">
        <h1>🧠 Models</h1>
        <p class="subtitle">
          共 {{ providers.length }} 个 Provider
        </p>
      </div>
      <div class="header-actions">
        <button
          class="test-all-btn"
          :disabled="isTestingAny()"
          @click="runTestAllModels"
        >
          {{ isTestingAny() ? '测试中...' : '测试全部' }}
        </button>
        <button class="back-btn" @click="goBack">
          返回
        </button>
      </div>
    </div>

    <!-- 默认模型和 Fallback -->
    <div class="defaults-card">
      <div class="default-item">
        <span class="default-label">默认模型:</span>
        <span class="default-badge primary">
          🧠 {{ defaults.model }}
        </span>
      </div>
      <div v-if="defaults.fallbacks.length > 0" class="default-item">
        <span class="default-label">Fallback:</span>
        <span
          v-for="(f, i) in defaults.fallbacks"
          :key="i"
          class="default-badge fallback"
        >
          🔄 {{ f }}
        </span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <p>加载中...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <p class="error-text">加载失败: {{ error }}</p>
      <button class="retry-btn" @click="loadData">重试</button>
    </div>

    <!-- Provider 列表 -->
    <div v-else class="providers-list">
      <div
        v-for="provider in providers"
        :key="provider.id"
        class="provider-card"
      >
        <!-- Provider 头部 -->
        <div class="provider-header">
          <div class="provider-info">
            <h2>{{ provider.id }}</h2>
            <span class="provider-api">API: {{ provider.api || '-' }}</span>
          </div>
          <div v-if="provider.usedBy && provider.usedBy.length > 0" class="used-by">
            <span class="used-by-label">使用者:</span>
            <span
              v-for="a in provider.usedBy"
              :key="a.id"
              class="used-by-badge"
              :title="a.id"
            >
              {{ a.emoji }} {{ a.name || a.id }}
            </span>
          </div>
        </div>

        <!-- 模型表格 -->
        <div v-if="provider.models.length > 0" class="models-table-wrapper">
          <!-- 桌面端表格 -->
          <table class="models-table">
            <thead>
              <tr>
                <th>Model ID</th>
                <th>名称</th>
                <th>访问方式</th>
                <th>Context</th>
                <th>最大输出</th>
                <th>输入类型</th>
                <th>Reasoning</th>
                <th>Input Token</th>
                <th>Output Token</th>
                <th>响应时间</th>
                <th>测试</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in provider.models" :key="m.id">
                <td class="model-id">{{ m.id }}</td>
                <td>{{ m.name || m.id }}</td>
                <td>
                  <span class="access-badge">
                    {{ provider.accessMode === 'auth' ? 'OAuth' : 'API Key' }}
                  </span>
                </td>
                <td>{{ m.contextWindow ? formatNum(m.contextWindow) : '-' }}</td>
                <td>{{ m.maxTokens ? formatNum(m.maxTokens) : '-' }}</td>
                <td>
                  <div class="input-types">
                    <span
                      v-for="inputType in (m.input || [])"
                      :key="inputType"
                      class="input-badge"
                    >
                      {{ inputType === 'text' ? '📝' : '🖼️' }} {{ inputType }}
                    </span>
                  </div>
                </td>
                <td>{{ m.reasoning ? '✅' : '❌' }}</td>
                <td class="token-input">
                  {{ getStat(provider.id, m.id) ? formatTokens(getStat(provider.id, m.id)!.inputTokens) : '-' }}
                </td>
                <td class="token-output">
                  {{ getStat(provider.id, m.id) ? formatTokens(getStat(provider.id, m.id)!.outputTokens) : '-' }}
                </td>
                <td class="response-time">
                  {{ getStat(provider.id, m.id) ? formatMs(getStat(provider.id, m.id)!.avgResponseMs) : '-' }}
                </td>
                <td>
                  <div class="test-cell">
                    <button
                      class="test-btn"
                      :disabled="testing[`${provider.id}/${m.id}`]"
                      @click="runTestModel(provider.id, m.id)"
                    >
                      {{ testing[`${provider.id}/${m.id}`] ? '测试中' : '测试' }}
                    </button>
                    <span
                      v-if="testResults[`${provider.id}/${m.id}`]"
                      class="test-result"
                      :class="{ success: testResults[`${provider.id}/${m.id}`].ok, error: !testResults[`${provider.id}/${m.id}`].ok }"
                      :title="testResults[`${provider.id}/${m.id}`].ok ? testResults[`${provider.id}/${m.id}`].text : testResults[`${provider.id}/${m.id}`].error"
                    >
                      {{ testResults[`${provider.id}/${m.id}`].ok ? '✅ ' + formatMs(testResults[`${provider.id}/${m.id}`].elapsed) : '❌ ' + (testResults[`${provider.id}/${m.id}`].error?.slice(0, 30) || 'Failed') }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 移动端卡片 -->
          <div class="models-cards-mobile">
            <div
              v-for="m in provider.models"
              :key="m.id"
              class="model-card"
            >
              <div class="model-card-header">
                <div>
                  <div class="model-id">{{ m.id }}</div>
                  <div class="model-name">{{ m.name || m.id }}</div>
                </div>
                <span class="access-badge">
                  {{ provider.accessMode === 'auth' ? 'OAuth' : 'API Key' }}
                </span>
              </div>

              <div class="model-card-stats">
                <div class="stat-item">
                  <span class="stat-label">Input</span>
                  <span class="stat-value input">{{ getStat(provider.id, m.id) ? formatTokens(getStat(provider.id, m.id)!.inputTokens) : '-' }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Output</span>
                  <span class="stat-value output">{{ getStat(provider.id, m.id) ? formatTokens(getStat(provider.id, m.id)!.outputTokens) : '-' }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">响应</span>
                  <span class="stat-value">{{ getStat(provider.id, m.id) ? formatMs(getStat(provider.id, m.id)!.avgResponseMs) : '-' }}</span>
                </div>
                <div v-if="m.contextWindow" class="stat-item">
                  <span class="stat-label">Context</span>
                  <span class="stat-value">{{ formatNum(m.contextWindow) }}</span>
                </div>
              </div>

              <div class="model-card-features">
                <span
                  v-for="inputType in (m.input || [])"
                  :key="inputType"
                  class="feature-badge"
                >
                  {{ inputType === 'text' ? '📝' : '🖼️' }} {{ inputType }}
                </span>
                <span class="feature-badge">
                  Reasoning: {{ m.reasoning ? '✅' : '❌' }}
                </span>
              </div>

              <div class="model-card-test">
                <button
                  class="test-btn"
                  :disabled="testing[`${provider.id}/${m.id}`]"
                  @click="runTestModel(provider.id, m.id)"
                >
                  {{ testing[`${provider.id}/${m.id}`] ? '测试中' : '测试' }}
                </button>
                <span
                  v-if="testResults[`${provider.id}/${m.id}`]"
                  class="test-result"
                  :class="{ success: testResults[`${provider.id}/${m.id}`].ok, error: !testResults[`${provider.id}/${m.id}`].ok }"
                >
                  {{ testResults[`${provider.id}/${m.id}`].ok ? '✅ ' + formatMs(testResults[`${provider.id}/${m.id}`].elapsed) : '❌ ' + (testResults[`${provider.id}/${m.id}`].error?.slice(0, 20) || 'Failed') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 无显式模型 -->
        <div v-else class="no-models">
          <p>未配置模型列表</p>
          <div
            v-if="Object.values(modelStats).filter(s => s.provider === provider.id).length > 0"
            class="inferred-models"
          >
            <span
              v-for="s in Object.values(modelStats).filter(s => s.provider === provider.id)"
              :key="s.modelId"
              class="inferred-model-badge"
            >
              <span class="model-id">{{ s.modelId }}</span>
              <span class="token-info">
                Input: {{ formatTokens(s.inputTokens) }} |
                Output: {{ formatTokens(s.outputTokens) }} |
                {{ formatMs(s.avgResponseMs) }}
              </span>
              <button
                class="test-btn small"
                :disabled="testing[`${provider.id}/${s.modelId}`]"
                @click="runTestModel(provider.id, s.modelId)"
              >
                {{ testing[`${provider.id}/${s.modelId}`] ? '⏳' : '测试' }}
              </button>
              <span
                v-if="testResults[`${provider.id}/${s.modelId}`]"
                class="test-result small"
                :class="{ success: testResults[`${provider.id}/${s.modelId}`].ok }"
              >
                {{ testResults[`${provider.id}/${s.modelId}`].ok ? '✅' : '❌' }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.models-view {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

/* Header */
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
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
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--abyss-black);
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
  background: var(--text-muted);
  cursor: wait;
}

.back-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
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

/* Defaults Card */
.defaults-card {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
}

.default-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.default-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.default-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  border: 1px solid;
}

.default-badge.primary {
  background: rgba(34, 197, 94, 0.2);
  color: rgb(134, 239, 172);
  border-color: rgba(34, 197, 94, 0.3);
}

.default-badge.fallback {
  background: rgba(234, 179, 8, 0.2);
  color: rgb(253, 224, 71);
  border-color: rgba(234, 179, 8, 0.3);
}

/* Provider Card */
.provider-card {
  padding: 1.25rem;
  margin-bottom: 1rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
}

.provider-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.provider-info h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.provider-api {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.used-by {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.used-by-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.used-by-badge {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--ocean-dark);
  border-radius: 9999px;
}

/* Models Table */
.models-table-wrapper {
  overflow-x: auto;
}

.models-table {
  width: 100%;
  font-size: 0.8125rem;
  border-collapse: collapse;
}

.models-table th {
  padding: 0.625rem 0.75rem;
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-glass);
}

.models-table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  vertical-align: middle;
}

.model-id {
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  color: var(--bio-cyan);
}

.access-badge {
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  background: var(--ocean-dark);
  border-radius: 2px;
}

.input-types {
  display: flex;
  gap: 0.25rem;
}

.input-badge {
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  background: var(--ocean-dark);
  border-radius: 2px;
}

.token-input {
  color: rgb(96, 165, 250);
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
}

.token-output {
  color: rgb(52, 211, 153);
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
}

.response-time {
  color: rgb(251, 191, 36);
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
}

.test-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.test-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--bio-cyan);
  background: rgba(0, 245, 255, 0.1);
  border: 1px solid rgba(0, 245, 255, 0.3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.test-btn:hover:not(:disabled) {
  background: rgba(0, 245, 255, 0.2);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.test-btn.small {
  padding: 0.25rem 0.5rem;
  font-size: 0.625rem;
}

.test-result {
  font-size: 0.625rem;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.test-result.success {
  color: rgb(74, 222, 128);
}

.test-result.error {
  color: rgb(248, 113, 113);
}

.test-result.small {
  font-size: 0.5625rem;
}

/* Mobile Cards */
.models-cards-mobile {
  display: none;
}

.model-card {
  padding: 0.875rem;
  margin-bottom: 0.625rem;
  background: var(--ocean-dark);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}

.model-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.model-card-header .model-name {
  font-size: 0.875rem;
  color: var(--text-primary);
}

.model-card-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.stat-item {
  padding: 0.5rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}

.stat-label {
  display: block;
  font-size: 0.6875rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 500;
  font-family: ui-monospace, monospace;
}

.stat-value.input {
  color: rgb(96, 165, 250);
}

.stat-value.output {
  color: rgb(52, 211, 153);
}

.model-card-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.feature-badge {
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
  background: rgba(10, 17, 40, 0.6);
  border-radius: 2px;
}

.model-card-test {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* No Models */
.no-models {
  color: var(--text-muted);
  font-size: 0.875rem;
}

.inferred-models {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.inferred-model-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--ocean-dark);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
}

.inferred-model-badge .token-info {
  color: var(--text-muted);
  font-size: 0.6875rem;
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
}

/* Responsive */
@media (max-width: 1024px) {
  .models-table {
    display: none;
  }

  .models-cards-mobile {
    display: block;
  }
}

@media (max-width: 768px) {
  .models-view {
    padding: 1rem;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>