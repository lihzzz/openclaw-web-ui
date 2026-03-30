<script setup lang="ts">
import { computed } from 'vue'
import type { SchedulerAgent } from '@/types/scheduler'
import { CAPABILITY_INFO } from '@/types/scheduler'

interface Props {
  agents: SchedulerAgent[]
  workload: Record<string, number>
}

const props = defineProps<Props>()

// 状态颜色映射
const statusColors: Record<string, string> = {
  idle: '#10b981',
  busy: '#f59e0b',
  offline: '#6b7280'
}

// 状态标签映射
const statusLabels: Record<string, string> = {
  idle: '空闲',
  busy: '忙碌',
  offline: '离线'
}

// 获取能力信息
function getCapabilityIcon(type: string): string {
  return CAPABILITY_INFO[type as keyof typeof CAPABILITY_INFO]?.icon || '📋'
}

// 计算统计
const stats = computed(() => ({
  total: props.agents.length,
  idle: props.agents.filter(a => a.status === 'idle').length,
  busy: props.agents.filter(a => a.status === 'busy').length,
  offline: props.agents.filter(a => a.status === 'offline').length
}))
</script>

<template>
  <div class="agent-panel">
    <!-- 面板头 -->
    <div class="panel-header">
      <h3 class="panel-title">🤖 Agents</h3>
      <div class="panel-stats">
        <span class="stat">
          <span class="stat-dot idle"></span>
          {{ stats.idle }} 空闲
        </span>
        <span class="stat">
          <span class="stat-dot busy"></span>
          {{ stats.busy }} 忙碌
        </span>
      </div>
    </div>
    
    <!-- Agent 列表 -->
    <div class="agent-list">
      <div 
        v-for="agent in agents" 
        :key="agent.id"
        class="agent-card"
        :class="[`status-${agent.status}`]"
      >
        <!-- Agent 头部 -->
        <div class="agent-header">
          <span class="agent-emoji">{{ agent.emoji }}</span>
          <div class="agent-info">
            <span class="agent-name">{{ agent.name }}</span>
            <span class="agent-status" :style="{ color: statusColors[agent.status] }">
              {{ statusLabels[agent.status] }}
            </span>
          </div>
        </div>
        
        <!-- 能力标签 -->
        <div class="capability-tags">
          <span 
            v-for="cap in agent.capabilities.slice(0, 3)" 
            :key="cap"
            class="capability-tag"
            :title="CAPABILITY_INFO[cap]?.description"
          >
            {{ getCapabilityIcon(cap) }}
          </span>
          <span v-if="agent.capabilities.length > 3" class="capability-more">
            +{{ agent.capabilities.length - 3 }}
          </span>
        </div>
        
        <!-- 统计 -->
        <div class="agent-stats">
          <div class="stat-item">
            <span class="stat-value">{{ agent.completedTasks }}</span>
            <span class="stat-label">完成</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ agent.failedTasks }}</span>
            <span class="stat-label">失败</span>
          </div>
          <div v-if="workload[agent.id]" class="stat-item">
            <span class="stat-value">{{ workload[agent.id] }}</span>
            <span class="stat-label">当前</span>
          </div>
        </div>
        
        <!-- 当前任务 -->
        <div v-if="agent.currentTaskId" class="current-task">
          <span class="task-label">当前任务:</span>
          <span class="task-id">{{ agent.currentTaskId }}</span>
        </div>
        
        <!-- 模型 -->
        <div v-if="agent.model" class="agent-model">
          <span class="model-label">模型:</span>
          <span class="model-name">{{ agent.model }}</span>
        </div>
      </div>
    </div>
    
    <!-- 空状态 -->
    <div v-if="agents.length === 0" class="empty-state">
      <p>暂无 Agent</p>
    </div>
  </div>
</template>

<style scoped>
.agent-panel {
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  overflow: hidden;
}

.panel-header {
  padding: 1rem;
  background: rgba(10, 17, 40, 0.4);
  border-bottom: 1px solid var(--border-glass);
}

.panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.panel-stats {
  display: flex;
  gap: 0.75rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.625rem;
  color: var(--text-muted);
}

.stat-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}

.stat-dot.idle {
  background: #10b981;
}

.stat-dot.busy {
  background: #f59e0b;
}

/* Agent 列表 */
.agent-list {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
  padding: 0.5rem;
}

.agent-card {
  padding: 0.75rem;
  background: var(--ocean-dark);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  margin-bottom: 0.5rem;
  transition: all var(--transition-fast);
}

.agent-card:last-child {
  margin-bottom: 0;
}

.agent-card.status-busy {
  border-left: 3px solid #f59e0b;
}

.agent-card.status-idle {
  border-left: 3px solid #10b981;
}

.agent-card.status-offline {
  opacity: 0.5;
}

/* Agent 头部 */
.agent-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.agent-emoji {
  font-size: 1.25rem;
}

.agent-info {
  display: flex;
  flex-direction: column;
}

.agent-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.agent-status {
  font-size: 0.625rem;
}

/* 能力标签 */
.capability-tags {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.capability-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.75rem;
  background: rgba(0, 245, 255, 0.1);
  border-radius: var(--radius-sm);
  cursor: help;
}

.capability-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
  height: 1.5rem;
  font-size: 0.625rem;
  color: var(--text-muted);
  background: var(--abyss-black);
  border-radius: var(--radius-sm);
}

/* 统计 */
.agent-stats {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-glass);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.stat-label {
  font-size: 0.5rem;
  color: var(--text-muted);
}

/* 当前任务 */
.current-task {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding: 0.375rem;
  background: rgba(0, 245, 255, 0.05);
  border-radius: var(--radius-sm);
}

.task-label {
  font-size: 0.625rem;
  color: var(--text-muted);
}

.task-id {
  font-size: 0.625rem;
  color: var(--bio-cyan);
  font-family: var(--font-mono);
}

/* 模型 */
.agent-model {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.375rem;
}

.model-label {
  font-size: 0.625rem;
  color: var(--text-muted);
}

.model-name {
  font-size: 0.625rem;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.empty-state p {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>