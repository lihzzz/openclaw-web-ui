<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import {
  fetchHotReloadStatus,
  fetchConfigForHotReload,
  applyConfigPatch,
  reloadConfig
} from '@/services/agentApi'
import type { HotReloadStatus, ConfigHotReloadResult } from '@/types'

// State
const loading = ref(false)
const status = ref<HotReloadStatus | null>(null)
const configResult = ref<ConfigHotReloadResult | null>(null)
const editedJson = ref('')
const isEditing = ref(false)
const error = ref('')
const success = ref('')
const lastUpdated = ref('')
const activeSection = ref<string>('agents')
const showRawJson = ref(false)

// Refresh timer
let refreshTimer: ReturnType<typeof setInterval> | null = null

// Computed
const isGatewayAvailable = computed(() => status.value?.gatewayAvailable === true)
const isConfigValid = computed(() => status.value?.configValid !== false)

const config = computed(() => configResult.value?.config || {})

// Parsed config sections
const agentsList = computed(() => {
  const list = config.value?.agents?.list || []
  return list.map((agent: any) => ({
    id: agent.id || '-',
    name: agent.name || agent.id || '-',
    model: agent.model || '-',
    emoji: agent.identity?.emoji || '🤖',
    workspace: agent.workspace || '-',
    agentDir: agent.agentDir || '-'
  }))
})

const agentsDefaults = computed(() => {
  const defaults = config.value?.agents?.defaults || {}
  return {
    model: typeof defaults.model === 'string' ? defaults.model :
           (defaults.model?.primary || '-'),
    fallbacks: defaults.model?.fallbacks || [],
    models: defaults.models || {}
  }
})

const providers = computed(() => {
  const providersMap = config.value?.models?.providers || {}
  return Object.entries(providersMap).map(([id, provider]: [string, any]) => ({
    id,
    api: provider.api || '-',
    models: (provider.models || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      reasoning: m.reasoning
    }))
  }))
})

const channels = computed(() => {
  const channelsMap = config.value?.channels || {}
  return Object.entries(channelsMap).map(([name, cfg]: [string, any]) => ({
    name,
    enabled: cfg?.enabled !== false,
    accounts: cfg?.accounts ? Object.keys(cfg.accounts) : []
  }))
})

const bindings = computed(() => {
  const list = config.value?.bindings || []
  return list.map((b: any) => ({
    agentId: b.agentId || '-',
    channel: b.match?.channel || '-',
    accountId: b.match?.accountId || '-'
  }))
})

const gatewayConfig = computed(() => {
  const gw = config.value?.gateway || {}
  return {
    port: gw.port || 18789,
    host: gw.host || gw.hostname || 'localhost',
    token: gw.auth?.token ? '***' : '-'
  }
})

const authProfiles = computed(() => {
  const profiles = config.value?.auth?.profiles || {}
  return Object.entries(profiles).map(([key, profile]: [string, any]) => ({
    key,
    provider: profile?.provider || key.split(':')[0],
    type: profile?.type || '-'
  }))
})

// Methods
async function refreshStatus() {
  try {
    status.value = await fetchHotReloadStatus()
  } catch (err: any) {
    status.value = {
      ok: false,
      gatewayAvailable: false,
      error: err.message
    }
  }
}

async function loadConfig() {
  loading.value = true
  error.value = ''

  try {
    configResult.value = await fetchConfigForHotReload()
    lastUpdated.value = new Date().toLocaleTimeString()
  } catch (err: any) {
    error.value = `加载配置失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

async function handleReload() {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const result = await reloadConfig()
    if (result.ok) {
      success.value = '配置已重新加载'
      await loadConfig()
    } else {
      error.value = `重新加载失败: ${result.error}`
    }
  } catch (err: any) {
    error.value = `重新加载失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

function startEditing() {
  editedJson.value = JSON.stringify(config.value, null, 2)
  isEditing.value = true
  error.value = ''
  success.value = ''
}

function cancelEditing() {
  isEditing.value = false
  error.value = ''
}

async function saveConfig() {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const patch = JSON.parse(editedJson.value)
    const result = await applyConfigPatch(
      patch,
      status.value?.hash,
      'Dashboard config edit'
    )

    if (result.ok) {
      success.value = '配置已保存并热加载'
      isEditing.value = false
      await loadConfig()
      await refreshStatus()
    } else {
      error.value = `保存失败: ${result.error}`
    }
  } catch (err: any) {
    if (err.message.includes('JSON')) {
      error.value = 'JSON 格式错误'
    } else {
      error.value = `保存失败: ${err.message}`
    }
  } finally {
    loading.value = false
  }
}

async function handleRefresh() {
  await Promise.all([refreshStatus(), loadConfig()])
}

// Lifecycle
onMounted(async () => {
  await handleRefresh()
  refreshTimer = setInterval(() => {
    refreshStatus()
  }, 10000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<template>
  <div class="config-view">
    <!-- Header -->
    <div class="view-header">
      <div class="header-title">
        <h1>⚙️ 实时配置</h1>
        <p class="subtitle">OpenClaw 配置管理与热加载</p>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
      <div class="status-item">
        <span class="status-label">Gateway</span>
        <span class="status-value" :class="isGatewayAvailable ? 'connected' : 'disconnected'">
          {{ isGatewayAvailable ? '🟢 在线' : '🔴 离线' }}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">配置状态</span>
        <span class="status-value" :class="isConfigValid ? 'valid' : 'invalid'">
          {{ isConfigValid ? '✓ 有效' : '✗ 无效' }}
        </span>
      </div>
      <div v-if="status?.hash" class="status-item">
        <span class="status-label">Hash</span>
        <span class="status-value hash">{{ status.hash.slice(0, 8) }}...</span>
      </div>
      <div class="status-item">
        <span class="status-label">更新时间</span>
        <span class="status-value">{{ lastUpdated || '-' }}</span>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="btn btn-secondary" :disabled="loading" @click="handleRefresh">
          {{ loading ? '⏳' : '🔄' }} 刷新
        </button>
        <button v-if="isGatewayAvailable && !isEditing" class="btn btn-secondary" :disabled="loading" @click="handleReload">
          🔃 重新加载
        </button>
        <button v-if="!isEditing" class="btn btn-secondary" @click="showRawJson = !showRawJson">
          {{ showRawJson ? '📋 表格视图' : '📄 JSON 视图' }}
        </button>
      </div>
      <div class="toolbar-right">
        <button v-if="!isEditing && isGatewayAvailable" class="btn btn-primary" :disabled="loading" @click="startEditing">
          ✏️ 编辑 JSON
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div v-if="error" class="message error">{{ error }}</div>
    <div v-if="success" class="message success">{{ success }}</div>

    <!-- Loading State -->
    <div v-if="loading && !configResult" class="loading-state">
      <p>加载配置中...</p>
    </div>

    <!-- Gateway Unavailable -->
    <div v-else-if="!isGatewayAvailable && status" class="warning-state">
      <p class="warning-text">⚠️ Gateway 不可用</p>
      <p class="warning-detail">{{ status.error || '请确保 OpenClaw Gateway 正在运行以使用热加载功能' }}</p>
      <p class="warning-hint">运行 <code>openclaw gateway start</code> 启动 Gateway</p>
    </div>

    <!-- JSON Editor Mode -->
    <div v-else-if="isEditing" class="config-editor">
      <div class="editor-header">
        <h2>编辑配置 (JSON)</h2>
        <span class="source-badge" :class="configResult?.source">
          {{ configResult?.source === 'gateway' ? 'Gateway' : '文件' }}
        </span>
      </div>
      <div class="config-edit">
        <textarea v-model="editedJson" class="json-editor" spellcheck="false"></textarea>
        <div class="edit-actions">
          <button class="btn btn-secondary" :disabled="loading" @click="cancelEditing">取消</button>
          <button class="btn btn-primary" :disabled="loading" @click="saveConfig">
            {{ loading ? '保存中...' : '保存并热加载' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Raw JSON View -->
    <div v-else-if="showRawJson" class="config-editor">
      <div class="editor-header">
        <h2>配置内容 (JSON)</h2>
        <span class="source-badge" :class="configResult?.source">
          {{ configResult?.source === 'gateway' ? 'Gateway' : '文件' }}
        </span>
      </div>
      <div class="config-preview">
        <pre>{{ JSON.stringify(config, null, 2) }}</pre>
      </div>
    </div>

    <!-- Table View -->
    <div v-else class="config-sections">
      <!-- Section Tabs -->
      <div class="section-tabs">
        <button
          v-for="tab in ['agents', 'models', 'channels', 'bindings', 'gateway', 'auth']"
          :key="tab"
          class="tab-btn"
          :class="{ active: activeSection === tab }"
          @click="activeSection = tab"
        >
          {{ tab === 'agents' ? '🤖 Agents' :
             tab === 'models' ? '🧠 Models' :
             tab === 'channels' ? '📡 Channels' :
             tab === 'bindings' ? '🔗 Bindings' :
             tab === 'gateway' ? '🌐 Gateway' : '🔐 Auth' }}
        </button>
      </div>

      <!-- Agents Section -->
      <div v-if="activeSection === 'agents'" class="section-content">
        <div class="section-header">
          <h3>默认配置</h3>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">默认模型</span>
            <span class="info-value code">{{ agentsDefaults.model }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Fallback 模型</span>
            <span class="info-value">{{ agentsDefaults.fallbacks.length > 0 ? agentsDefaults.fallbacks.join(', ') : '-' }}</span>
          </div>
        </div>

        <div class="section-header">
          <h3>Agent 列表 ({{ agentsList.length }})</h3>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>名称</th>
                <th>模型</th>
                <th>工作空间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="agent in agentsList" :key="agent.id">
                <td><code>{{ agent.id }}</code></td>
                <td>{{ agent.emoji }} {{ agent.name }}</td>
                <td><code class="model-code">{{ agent.model }}</code></td>
                <td>{{ agent.workspace }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Models Section -->
      <div v-if="activeSection === 'models'" class="section-content">
        <div class="section-header">
          <h3>模型提供商 ({{ providers.length }})</h3>
        </div>
        <div v-for="provider in providers" :key="provider.id" class="provider-card">
          <div class="provider-header">
            <span class="provider-id">{{ provider.id }}</span>
            <span class="provider-api">{{ provider.api }}</span>
          </div>
          <div class="models-grid">
            <div v-for="model in provider.models" :key="model.id" class="model-chip">
              <span class="model-name">{{ model.name }}</span>
              <span v-if="model.reasoning" class="model-tag reasoning">推理</span>
              <span v-if="model.contextWindow" class="model-tag">{{ Math.round(model.contextWindow / 1000) }}K</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Channels Section -->
      <div v-if="activeSection === 'channels'" class="section-content">
        <div class="section-header">
          <h3>渠道配置 ({{ channels.length }})</h3>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>渠道</th>
                <th>状态</th>
                <th>账户</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="channel in channels" :key="channel.name">
                <td><span class="channel-name">{{ channel.name }}</span></td>
                <td>
                  <span class="status-badge" :class="channel.enabled ? 'enabled' : 'disabled'">
                    {{ channel.enabled ? '✓ 启用' : '✗ 禁用' }}
                  </span>
                </td>
                <td>{{ channel.accounts.length > 0 ? channel.accounts.join(', ') : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bindings Section -->
      <div v-if="activeSection === 'bindings'" class="section-content">
        <div class="section-header">
          <h3>绑定配置 ({{ bindings.length }})</h3>
        </div>
        <div v-if="bindings.length === 0" class="empty-state">
          <p>暂无绑定配置</p>
        </div>
        <div v-else class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>渠道</th>
                <th>账户</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(binding, idx) in bindings" :key="idx">
                <td><code>{{ binding.agentId }}</code></td>
                <td>{{ binding.channel }}</td>
                <td>{{ binding.accountId }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Gateway Section -->
      <div v-if="activeSection === 'gateway'" class="section-content">
        <div class="section-header">
          <h3>Gateway 配置</h3>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Host</span>
            <span class="info-value code">{{ gatewayConfig.host }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Port</span>
            <span class="info-value code">{{ gatewayConfig.port }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Token</span>
            <span class="info-value">{{ gatewayConfig.token }}</span>
          </div>
        </div>
      </div>

      <!-- Auth Section -->
      <div v-if="activeSection === 'auth'" class="section-content">
        <div class="section-header">
          <h3>认证配置 ({{ authProfiles.length }})</h3>
        </div>
        <div v-if="authProfiles.length === 0" class="empty-state">
          <p>暂无认证配置</p>
        </div>
        <div v-else class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Provider</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="profile in authProfiles" :key="profile.key">
                <td><code>{{ profile.key }}</code></td>
                <td>{{ profile.provider }}</td>
                <td>{{ profile.type }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-view {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

/* Header */
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

/* Status Bar */
.status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  margin-bottom: 1rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.status-value {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-primary);
}

.status-value.connected { color: var(--success); }
.status-value.disconnected { color: var(--error); }
.status-value.valid { color: var(--success); }
.status-value.invalid { color: var(--error); }
.status-value.hash {
  font-family: var(--font-mono);
  font-size: 0.625rem;
}

/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  color: var(--abyss-black);
  background: var(--bio-cyan);
  border: 1px solid var(--bio-cyan);
}

.btn-primary:hover:not(:disabled) {
  background: #00d4e0;
}

.btn-secondary {
  color: var(--text-primary);
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--bio-cyan);
}

/* Messages */
.message {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.message.error {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.message.success {
  color: #86efac;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  color: var(--text-muted);
}

/* Warning State */
.warning-state {
  padding: 2rem;
  text-align: center;
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: var(--radius);
  margin-bottom: 1rem;
}

.warning-text {
  font-size: 1rem;
  font-weight: 600;
  color: #fcd34d;
  margin-bottom: 0.5rem;
}

.warning-detail {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.warning-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.warning-hint code {
  padding: 0.125rem 0.375rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
}

/* Config Editor */
.config-editor {
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-glass);
}

.editor-header h2 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.source-badge {
  font-size: 0.625rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.source-badge.gateway {
  color: var(--bio-cyan);
  background: rgba(0, 245, 255, 0.1);
}

.source-badge.file {
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
}

.config-preview {
  max-height: 600px;
  overflow: auto;
}

.config-preview pre {
  margin: 0;
  padding: 1rem;
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
}

.config-edit {
  padding: 1rem;
}

.json-editor {
  width: 100%;
  min-height: 500px;
  padding: 1rem;
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--text-primary);
  background: var(--ocean-dark);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  resize: vertical;
}

.json-editor:focus {
  outline: none;
  border-color: var(--bio-cyan);
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* Section Tabs */
.section-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
  padding: 0.25rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  overflow-x: auto;
}

.tab-btn {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--abyss-black);
  background: var(--bio-cyan);
}

/* Section Content */
.section-content {
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  padding: 1rem;
}

.section-header {
  margin-bottom: 0.75rem;
}

.section-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.section-header:not(:first-child) {
  margin-top: 1.5rem;
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.info-item {
  padding: 0.75rem;
  background: var(--ocean-dark);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}

.info-label {
  display: block;
  font-size: 0.625rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.info-value {
  font-size: 0.875rem;
  color: var(--text-primary);
}

.info-value.code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

/* Data Table */
.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.data-table th,
.data-table td {
  padding: 0.625rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border-glass);
}

.data-table th {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.data-table td {
  color: var(--text-primary);
}

.data-table code {
  padding: 0.125rem 0.375rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.model-code {
  color: var(--bio-cyan);
}

/* Provider Card */
.provider-card {
  padding: 1rem;
  background: var(--ocean-dark);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  margin-bottom: 0.75rem;
}

.provider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.provider-id {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.provider-api {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.models-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.model-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: rgba(0, 245, 255, 0.1);
  border: 1px solid rgba(0, 245, 255, 0.2);
  border-radius: 999px;
  font-size: 0.75rem;
}

.model-name {
  color: var(--text-primary);
}

.model-tag {
  font-size: 0.625rem;
  padding: 0.0625rem 0.375rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}

.model-tag.reasoning {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.6875rem;
  font-weight: 500;
}

.status-badge.enabled {
  color: var(--success);
  background: rgba(34, 197, 94, 0.1);
}

.status-badge.disabled {
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
}

/* Channel Name */
.channel-name {
  text-transform: capitalize;
  font-weight: 500;
}

/* Empty State */
.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 768px) {
  .config-view {
    padding: 1rem;
  }

  .status-bar {
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .json-editor {
    min-height: 300px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>