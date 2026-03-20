<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  model: string
  accessMode?: 'auth' | 'api_key'
}>()

const parsed = computed(() => {
  const slashIdx = props.model.indexOf('/')
  if (slashIdx <= 0) {
    return { provider: 'default', name: props.model }
  }
  return {
    provider: props.model.slice(0, slashIdx),
    name: props.model.slice(slashIdx + 1)
  }
})

const colorClass = computed(() => {
  const colors: Record<string, string> = {
    'yunyi-claude': 'style-green',
    minimax: 'style-orange',
    volcengine: 'style-cyan',
    bailian: 'style-yellow'
  }
  return colors[parsed.value.provider] || 'style-default'
})
</script>

<template>
  <span class="model-badge" :class="colorClass">
    {{ parsed.name }}
    <span v-if="accessMode" class="access-mode">({{ accessMode }})</span>
  </span>
</template>

<style scoped>
.model-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  border: 1px solid;
  transition: all var(--transition-fast);
}

.model-badge:hover {
  transform: scale(1.02);
}

.access-mode {
  opacity: 0.7;
  font-size: 0.625rem;
}

.style-green {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
  border-color: rgba(34, 197, 94, 0.3);
}

.style-green:hover {
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.3);
}

.style-orange {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
  border-color: rgba(245, 158, 11, 0.3);
}

.style-orange:hover {
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
}

.style-cyan {
  background: var(--gold-dim);
  color: var(--gold-primary);
  border-color: rgba(212, 175, 55, 0.3);
}

.style-cyan:hover {
  box-shadow: var(--glow-gold);
}

.style-yellow {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.3);
}

.style-yellow:hover {
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.3);
}

.style-default {
  background: rgba(163, 163, 163, 0.1);
  color: var(--text-secondary);
  border-color: var(--border-glass);
}

.style-default:hover {
  border-color: var(--gold-primary);
  color: var(--gold-primary);
}
</style>