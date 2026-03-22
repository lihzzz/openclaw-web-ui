<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  duration?: number
}>()

const dots = ref('')
let interval: number | null = null

// 动画点
function animateDots(): void {
  interval = window.setInterval(() => {
    dots.value = dots.value.length >= 3 ? '' : dots.value + '.'
  }, 500)
}

onMounted(() => {
  animateDots()
})

onUnmounted(() => {
  if (interval) {
    clearInterval(interval)
  }
})

// 格式化耗时
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m${secs}s`
}
</script>

<template>
  <div class="typing-indicator">
    <!-- 气泡上升动画容器 -->
    <div class="bubble-container">
      <div class="bubble bubble-1"></div>
      <div class="bubble bubble-2"></div>
      <div class="bubble bubble-3"></div>
      <div class="bubble bubble-4"></div>
    </div>
    <span class="typing-text">
      思考中{{ dots }}
      <span v-if="duration" class="typing-duration">
        {{ formatDuration(duration) }}
      </span>
    </span>
  </div>
</template>

<style scoped>
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1.125rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-accent);
  border-radius: var(--radius);
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

/* 气泡容器 */
.bubble-container {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 20px;
  position: relative;
}

/* 单个气泡 */
.bubble {
  width: 6px;
  height: 6px;
  background: radial-gradient(circle at 30% 30%, var(--accent-light) 0%, var(--accent) 50%, var(--accent-dark) 100%);
  border-radius: 50%;
  position: relative;
  animation: bubbleRise 1.8s ease-in-out infinite;
}

/* 气泡高光 */
.bubble::before {
  content: '';
  position: absolute;
  top: 1px;
  left: 1px;
  width: 2px;
  height: 2px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
}

/* 不同气泡的动画延迟 */
.bubble-1 {
  animation-delay: 0s;
}

.bubble-2 {
  animation-delay: 0.15s;
  width: 5px;
  height: 5px;
}

.bubble-3 {
  animation-delay: 0.3s;
  width: 4px;
  height: 4px;
}

.bubble-4 {
  animation-delay: 0.45s;
  width: 3px;
  height: 3px;
}

/* 气泡上升动画 */
@keyframes bubbleRise {
  0% {
    transform: translateY(0) scale(0.5);
    opacity: 0;
  }
  15% {
    opacity: 0.9;
    transform: translateY(-2px) scale(0.7);
  }
  50% {
    opacity: 1;
    transform: translateY(-8px) scale(1);
  }
  85% {
    opacity: 0.6;
    transform: translateY(-14px) scale(0.8);
  }
  100% {
    transform: translateY(-20px) scale(0.3);
    opacity: 0;
  }
}

.typing-text {
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 500;
}

.typing-duration {
  color: var(--text-muted);
  font-size: 0.75rem;
  font-family: var(--font-mono);
  margin-left: 0.25rem;
  font-weight: 400;
}
</style>
