<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  state?: string
}>()

const config = computed(() => {
  const configs: Record<string, { text: string; colorClass: string; animate?: boolean }> = {
    working: { text: 'Working', colorClass: 'status-working', animate: true },
    online: { text: 'Online', colorClass: 'status-online' },
    idle: { text: 'Idle', colorClass: 'status-idle' },
    offline: { text: 'Offline', colorClass: 'status-offline' }
  }
  return configs[props.state || 'offline'] || configs.offline
})
</script>

<template>
  <span class="status-badge" :class="config.colorClass">
    <span class="status-dot-wrapper">
      <span
        class="status-dot"
        :class="{ 'animate-pulse': config.animate }"
      ></span>
      <span v-if="config.animate" class="status-pulse-ring"></span>
    </span>
    <span class="status-text">{{ config.text }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid transparent;
  transition: all var(--transition-fast);
}

.status-dot-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  position: relative;
  z-index: 1;
}

/* 脉冲扩散环 */
.status-pulse-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  animation: statusRunning 1.5s ease-out infinite;
}

@keyframes statusRunning {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.status-text {
  position: relative;
}

/* Working 状态 - 金色脉冲 */
.status-working {
  color: var(--gold-primary);
  border-color: rgba(212, 175, 55, 0.3);
  background: var(--gold-dim);
}

.status-working .status-dot {
  background: var(--gold-primary);
  box-shadow: 0 0 10px var(--gold-primary);
}

.status-working .status-pulse-ring {
  border: 1px solid var(--gold-primary);
}

/* Online 状态 - 绿色 */
.status-online {
  color: var(--success);
  border-color: rgba(34, 197, 94, 0.3);
  background: var(--success-dim);
}

.status-online .status-dot {
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}

/* Idle 状态 - 黄色 */
.status-idle {
  color: var(--warning);
  border-color: rgba(245, 158, 11, 0.3);
  background: var(--warning-dim);
}

.status-idle .status-dot {
  background: var(--warning);
  box-shadow: 0 0 8px var(--warning);
}

/* Offline 状态 - 红色 */
.status-offline {
  color: var(--error);
  border-color: rgba(239, 68, 68, 0.3);
  background: var(--error-dim);
}

.status-offline .status-dot {
  background: var(--error);
  box-shadow: 0 0 8px var(--error);
}

/* 悬停效果 */
.status-badge:hover {
  transform: scale(1.05);
}

.status-working:hover {
  box-shadow: var(--glow-gold);
}

.status-online:hover {
  box-shadow: var(--glow-success);
}

.status-idle:hover {
  box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);
}

.status-offline:hover {
  box-shadow: var(--glow-error);
}
</style>