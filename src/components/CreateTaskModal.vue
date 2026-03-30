<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SchedulerAgent, AgentCapability, TaskPriority, CreateTaskRequest } from '@/types/scheduler'
import { CAPABILITY_INFO, PRIORITY_INFO } from '@/types/scheduler'

interface Props {
  agents: SchedulerAgent[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', task: CreateTaskRequest): void
}>()

// 表单数据
const title = ref('')
const description = ref('')
const type = ref<AgentCapability>('general')
const priority = ref<TaskPriority>('normal')
const assignedAgentId = ref('')
const deadline = ref('')
const tags = ref('')

// 提交状态
const submitting = ref(false)
const error = ref('')

// 能力选项
const capabilityOptions = Object.entries(CAPABILITY_INFO).map(([key, info]) => ({
  value: key as AgentCapability,
  label: info.name,
  icon: info.icon,
  description: info.description
}))

// 优先级选项
const priorityOptions = Object.entries(PRIORITY_INFO).map(([key, info]) => ({
  value: key as TaskPriority,
  label: info.label,
  icon: info.icon,
  color: info.color
}))

// 可用的 Agent（有能力处理所选任务类型）
const availableAgents = computed(() => {
  return props.agents.filter(
    a => a.capabilities.includes(type.value) || a.capabilities.includes('general')
  )
})

// 表单验证
const isValid = computed(() => {
  return title.value.trim().length > 0
})

// 提交表单
async function handleSubmit(): Promise<void> {
  if (!isValid.value || submitting.value) return
  
  submitting.value = true
  error.value = ''
  
  try {
    const request: CreateTaskRequest = {
      title: title.value.trim(),
      description: description.value.trim(),
      type: type.value,
      priority: priority.value,
      assignedAgentId: assignedAgentId.value || undefined,
      deadline: deadline.value ? new Date(deadline.value).getTime() : undefined,
      tags: tags.value ? tags.value.split(',').map(t => t.trim()).filter(Boolean) : undefined
    }
    
    // 调用 API
    const response = await fetch('/api/scheduler/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
    
    const data = await response.json()
    
    if (data.error) {
      error.value = data.error
    } else {
      emit('created', request)
      emit('close')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    submitting.value = false
  }
}

// 关闭弹窗
function handleClose(): void {
  emit('close')
}

// 阻止冒泡
function stopPropagation(e: Event): void {
  e.stopPropagation()
}
</script>

<template>
  <div class="modal-overlay" @click="handleClose">
    <div class="modal-content" @click="stopPropagation">
      <!-- 头部 -->
      <div class="modal-header">
        <h2 class="modal-title">➕ 创建新任务</h2>
        <button class="close-btn" @click="handleClose">✕</button>
      </div>
      
      <!-- 表单 -->
      <form class="modal-body" @submit.prevent="handleSubmit">
        <!-- 任务标题 -->
        <div class="form-group">
          <label class="form-label required">任务标题</label>
          <input
            v-model="title"
            type="text"
            class="form-input"
            placeholder="输入任务标题..."
            maxlength="100"
          />
        </div>
        
        <!-- 任务描述 -->
        <div class="form-group">
          <label class="form-label">任务描述</label>
          <textarea
            v-model="description"
            class="form-textarea"
            placeholder="详细描述任务要求..."
            rows="3"
          ></textarea>
        </div>
        
        <!-- 任务类型和优先级 -->
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label required">任务类型</label>
            <select v-model="type" class="form-select">
              <option 
                v-for="opt in capabilityOptions" 
                :key="opt.value" 
                :value="opt.value"
              >
                {{ opt.icon }} {{ opt.label }}
              </option>
            </select>
          </div>
          
          <div class="form-group half">
            <label class="form-label">优先级</label>
            <select v-model="priority" class="form-select">
              <option 
                v-for="opt in priorityOptions" 
                :key="opt.value" 
                :value="opt.value"
              >
                {{ opt.icon }} {{ opt.label }}
              </option>
            </select>
          </div>
        </div>
        
        <!-- 指派 Agent -->
        <div class="form-group">
          <label class="form-label">指派 Agent (可选)</label>
          <select v-model="assignedAgentId" class="form-select">
            <option value="">自动分配</option>
            <option 
              v-for="agent in availableAgents" 
              :key="agent.id" 
              :value="agent.id"
              :disabled="agent.status !== 'idle'"
            >
              {{ agent.emoji }} {{ agent.name }}
              {{ agent.status !== 'idle' ? `(${agent.status})` : '' }}
            </option>
          </select>
          <span v-if="availableAgents.length === 0" class="form-hint">
            没有可用的 Agent 处理此类型任务
          </span>
        </div>
        
        <!-- 截止日期和标签 -->
        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">截止日期 (可选)</label>
            <input
              v-model="deadline"
              type="datetime-local"
              class="form-input"
            />
          </div>
          
          <div class="form-group half">
            <label class="form-label">标签 (可选)</label>
            <input
              v-model="tags"
              type="text"
              class="form-input"
              placeholder="用逗号分隔"
            />
          </div>
        </div>
        
        <!-- 错误提示 -->
        <div v-if="error" class="error-message">
          <span class="error-icon">⚠️</span>
          {{ error }}
        </div>
        
        <!-- 按钮 -->
        <div class="modal-footer">
          <button 
            type="button" 
            class="btn btn-secondary"
            @click="handleClose"
          >
            取消
          </button>
          <button 
            type="submit" 
            class="btn btn-primary"
            :disabled="!isValid || submitting"
          >
            {{ submitting ? '创建中...' : '创建任务' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
}

.modal-content {
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--ocean-dark);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-glass);
}

.modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  font-size: 1rem;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.1);
}

.modal-body {
  padding: 1.25rem;
}

/* 表单 */
.form-group {
  margin-bottom: 1rem;
}

.form-group.half {
  flex: 1;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.375rem;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--abyss-black);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast);
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--bio-cyan);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-select {
  cursor: pointer;
}

.form-hint {
  display: block;
  font-size: 0.625rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

/* 错误 */
.error-message {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem;
  font-size: 0.75rem;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
}

.error-icon {
  font-size: 0.875rem;
}

/* 按钮 */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-glass);
}

.btn {
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  color: var(--text-primary);
  background: transparent;
  border: 1px solid var(--border-glass);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--text-muted);
}

.btn-primary {
  color: var(--abyss-black);
  background: var(--bio-cyan);
}

.btn-primary:hover:not(:disabled) {
  background: #00d4e6;
}

/* 响应式 */
@media (max-width: 480px) {
  .modal-content {
    width: 95%;
    margin: 1rem;
  }
  
  .form-row {
    flex-direction: column;
    gap: 0;
  }
}
</style>