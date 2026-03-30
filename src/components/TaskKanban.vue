<script setup lang="ts">
import type { SchedulerTask, TaskStatus } from '@/types/scheduler'
import TaskCard from './TaskCard.vue'

interface Props {
  tasksByStatus: Record<TaskStatus, SchedulerTask[]>
  loading?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'create'): void
  (e: 'select', taskId: string): void
}>()

// 看板列配置
const columns: { status: TaskStatus; label: string; icon: string }[] = [
  { status: 'pending', label: '等待中', icon: '⏳' },
  { status: 'assigned', label: '已分配', icon: '👤' },
  { status: 'running', label: '执行中', icon: '⚡' },
  { status: 'completed', label: '已完成', icon: '✅' },
  { status: 'failed', label: '失败', icon: '❌' }
]

// 处理任务选择
function handleTaskClick(taskId: string): void {
  emit('select', taskId)
}
</script>

<template>
  <div class="task-kanban">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
    
    <!-- 看板列 -->
    <div class="kanban-columns">
      <div 
        v-for="column in columns" 
        :key="column.status"
        class="kanban-column"
      >
        <!-- 列头 -->
        <div class="column-header">
          <span class="column-icon">{{ column.icon }}</span>
          <span class="column-title">{{ column.label }}</span>
          <span class="column-count">
            {{ tasksByStatus[column.status]?.length || 0 }}
          </span>
        </div>
        
        <!-- 列内容 -->
        <div class="column-content">
          <!-- 空状态 -->
          <div 
            v-if="!tasksByStatus[column.status]?.length" 
            class="column-empty"
          >
            <span v-if="column.status === 'pending'" class="empty-hint">
              拖拽任务到这里
            </span>
          </div>
          
          <!-- 任务卡片 -->
          <TaskCard
            v-for="task in tasksByStatus[column.status]"
            :key="task.id"
            :task="task"
            @click="handleTaskClick(task.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-kanban {
  position: relative;
  min-height: 400px;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 17, 40, 0.8);
  z-index: 10;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--border-glass);
  border-top-color: var(--bio-cyan);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.kanban-columns {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background: var(--border-glass);
  min-height: 500px;
}

@media (max-width: 1400px) {
  .kanban-columns {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .kanban-columns {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .kanban-columns {
    grid-template-columns: 1fr;
  }
}

.kanban-column {
  display: flex;
  flex-direction: column;
  background: var(--ocean-dark);
}

.column-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(10, 17, 40, 0.4);
  border-bottom: 1px solid var(--border-glass);
  position: sticky;
  top: 0;
  z-index: 1;
}

.column-icon {
  font-size: 1rem;
}

.column-title {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.column-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--abyss-black);
  border-radius: 9999px;
}

.column-content {
  flex: 1;
  padding: 0.5rem;
  overflow-y: auto;
  max-height: calc(100vh - 300px);
}

.column-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  border: 2px dashed var(--border-glass);
  border-radius: var(--radius-sm);
}

.empty-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>