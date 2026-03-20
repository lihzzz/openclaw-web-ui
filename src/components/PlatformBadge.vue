<script setup lang="ts">
import type { AgentPlatform } from '@/types'

const props = defineProps<{
  platform: AgentPlatform
  agentId: string
  testResult?: { ok: boolean; error?: string; elapsed: number } | null
}>()

// 平台配置
const platformConfig: Record<string, { color: string; border: string; label: string }> = {
  feishu: {
    color: 'style-blue',
    border: 'rgba(59, 130, 246, 0.3)',
    label: 'Feishu'
  },
  discord: {
    color: 'style-purple',
    border: 'rgba(168, 85, 247, 0.3)',
    label: 'Discord'
  },
  telegram: {
    color: 'style-cyan',
    border: 'rgba(6, 182, 212, 0.3)',
    label: 'Telegram'
  },
  whatsapp: {
    color: 'style-green',
    border: 'rgba(34, 197, 94, 0.3)',
    label: 'WhatsApp'
  },
  qqbot: {
    color: 'style-blue',
    border: 'rgba(59, 130, 246, 0.3)',
    label: 'QQ'
  }
}

const config = computed(() => {
  return platformConfig[props.platform.name] || {
    color: 'style-default',
    border: 'var(--border-glass)',
    label: props.platform.name
  }
})

// 平台图标
const platformIcons: Record<string, string> = {
  feishu: '📱',
  discord: '🎮',
  telegram: '✈️',
  whatsapp: '💬',
  qqbot: '🐧'
}

const icon = computed(() => {
  return platformIcons[props.platform.name] || '🔌'
})
</script>

<template>
  <div class="platform-badge-wrapper">
    <span class="platform-badge" :class="config.color">
      <span class="platform-icon">{{ icon }}</span>
      <span class="platform-name">{{ config.label }}</span>
      <span v-if="platform.accountId" class="account-id">({{ platform.accountId }})</span>
    </span>

    <!-- 测试结果 -->
    <span class="test-result">
      <template v-if="testResult === undefined">
        <span class="result-pending">--</span>
      </template>
      <template v-else-if="testResult === null">
        <span class="result-loading">⏳</span>
      </template>
      <template v-else-if="testResult.ok">
        <span class="result-success" :title="`${testResult.elapsed}ms`">✅</span>
      </template>
      <template v-else>
        <span class="result-error" :title="testResult.error">❌</span>
      </template>
    </span>
  </div>
</template>

<script lang="ts">
import { computed } from 'vue'
export default {
  name: 'PlatformBadge'
}
</script>

<style scoped>
.platform-badge-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.platform-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  border: 1px solid;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.platform-badge:hover {
  transform: scale(1.05);
}

.platform-icon {
  font-size: 0.875rem;
}

.platform-name {
  text-transform: capitalize;
}

.account-id {
  opacity: 0.6;
  font-size: 0.625rem;
}

.style-blue {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.3);
}

.style-purple {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border-color: rgba(168, 85, 247, 0.3);
}

.style-cyan {
  background: rgba(6, 182, 212, 0.15);
  color: #22d3ee;
  border-color: rgba(6, 182, 212, 0.3);
}

.style-green {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.3);
}

.style-default {
  background: rgba(107, 143, 184, 0.15);
  color: var(--text-secondary);
  border-color: var(--border-glass);
}

.test-result {
  width: 1.25rem;
  text-align: right;
  font-size: 0.75rem;
}

.result-pending {
  color: var(--text-muted);
}

.result-loading {
  animation: pulse 1s ease-in-out infinite;
}

.result-success {
  color: var(--success);
  cursor: help;
}

.result-error {
  color: var(--error);
  cursor: help;
}
</style>