<script setup lang="ts">
import { computed } from 'vue'
import type { SchedulerTask } from '@/types/scheduler'
import { CAPABILITY_INFO, PRIORITY_INFO } from '@/types/scheduler'

interface Props {
  task: SchedulerTask
  compact?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'click'): void
}>()

// 计算属性
const capabilityInfo = computed(() => CAPABILITY_INFO[props.task.type])
const priorityInfo = computed(() => PRIORITY_INFO[props.task.priority])

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp
  
  // 小于1小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return minutes <= 1 ? '刚刚' : `${minutes}分钟前`
  }
  
  // 小于24小时
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}小时前`
  }
  
  // 显示日期
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

// 格式化持续时间
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

// 计算运行时间
const runningDuration = computed(() => {
  if (props.task.status !== 'running' || !props.task.startedAt) return null
  return Date.now() - props.task.startedAt
})
</script>

<template>
  <div 
    class="task-card"
    :class="[`priority-${task.priority}`, `status-${task.status}`]"
    @click="emit('click')"
  >
    <!-- 头部 -->
    <div class="card-header">
      <span class="task-type-icon">{{ capabilityInfo?.icon || '📋' }}</span>
      <span class="task-priority" :style="{ color: priorityInfo?.color }">
        {{ priorityInfo?.icon }}
      </span>
    </div>
    
    <!-- 标题 -->
    <h4 class="task-title">{{ task.title }}</h4>
    
    <!-- 描述 -->
    <p v-if="task.description && !compact" class="task-description">
      {{ task.description.slice(0, 100) }}
      <span v-if="task.description.length > 100">...</span>
    </p>
    
    <!-- 进度条 -->
    <div v-if="task.status === 'running'" class="progress-section">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${task.progress.percentage}%` }"
        ></div>
      </div>
      <span class="progress-text">
        {{ task.progress.percentage }}%
        <span v-if="task.progress.message">· {{ task.progress.message }}</span>
      </span>
    </div>
    
    <!-- 错误信息 -->
    <div v-if="task.error" class="error-section">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{{ task.error.slice(0, 50) }}</span>
    </div>
    
    <!-- 底部信息 -->
    <div class="card-footer">
      <span class="task-type">{{ capabilityInfo?.name || task.type }}</span>
      <span class="task-time">{{ formatTime(task.createdAt) }}</span>
    </div>
    
    <!-- 持续时间（运行中） -->
    <div v-if="runningDuration" class="duration-badge">
      {{ formatDuration(runningDuration) }}
    </div>
  </div>
</template>

<style scoped>
.task-card {
  position: relative;
  padding: 0.75rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.task-card:hover {
  border-color: var(--bio-cyan);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 245, 255, 0.1);
}

.task-card:last-child {
  margin-bottom: 0;
}

/* 优先级边框 */
.task-card.priority-urgent {
  border-left: 3px solid #ef4444;
}

.task-card.priority-high {
  border-left: 3px solid #f59e0b;
}

.task-card.priority-normal {
  border-left: 3px solid #3b82f6;
}

.task-card.priority-low {
  border-left: 3px solid #6b7280;
}

/* 状态样式 */
.task-card.status-running {
  background: rgba(0, 245, 255, 0.05);
}

.task-card.status-failed {
  background: rgba(239, 68, 68, 0.05);
}

.task-card.status-completed {
  opacity: 0.8;
}

/* 头部 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.task-type-icon {
  font-size: 1rem;
}

.task-priority {
  font-size: 0.75rem;
}

/* 标题 */
.task-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 描述 */
.task-description {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0 0 0.5rem;
  line-height: 1.4;
}

/* 进度 */
.progress-section {
  margin: 0.5rem 0;
}

.progress-bar {
  height: 4px;
  background: var(--abyss-black);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--bio-cyan);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.625rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
  display: block;
}

/* 错误 */
.error-section {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.375rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
  margin-top: 0.5rem;
}

.error-icon {
  font-size: 0.75rem;
}

.error-text {
  font-size: 0.625rem;
  color: #ef4444;
  line-height: 1.3;
}

/* 底部 */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-glass);
}

.task-type {
  font-size: 0.625rem;
  color: var(--bio-cyan);
  background: rgba(0, 245, 255, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
}

.task-time {
  font-size: 0.625rem;
  color: var(--text-muted);
}

/* 持续时间 */
.duration-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-family: var(--font-mono);
  color: var(--bio-cyan);
  background: rgba(0, 245, 255, 0.1);
  border-radius: 9999px;
}
</style>