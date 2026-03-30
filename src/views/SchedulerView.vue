<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useSchedulerStore } from '@/stores/scheduler'
import TaskKanban from '@/components/TaskKanban.vue'
import AgentPanel from '@/components/AgentPanel.vue'
import CreateTaskModal from '@/components/CreateTaskModal.vue'
import type { TaskStatus, AgentCapability, TaskPriority } from '@/types/scheduler'

const schedulerStore = useSchedulerStore()

// 视图模式
const viewMode = ref<'kanban' | 'list'>('kanban')

// 创建任务弹窗
const showCreateModal = ref(false)

// 刷新间隔
const refreshInterval = ref(30) // 秒
let refreshTimer: ReturnType<typeof setInterval> | null = null

// 筛选下拉菜单
const showFilterMenu = ref(false)
const filterStatus = ref<TaskStatus | ''>('')
const filterType = ref<AgentCapability | ''>('')
const filterPriority = ref<TaskPriority | ''>('')

// 应用筛选
function applyFilters(): void {
  schedulerStore.setFilter('status', filterStatus.value || null)
  schedulerStore.setFilter('type', filterType.value || null)
  schedulerStore.setFilter('priority', filterPriority.value || null)
  showFilterMenu.value = false
}

// 清除筛选
function clearFilters(): void {
  filterStatus.value = ''
  filterType.value = ''
  filterPriority.value = ''
  schedulerStore.clearFilters()
  showFilterMenu.value = false
}

// 手动刷新
async function handleRefresh(): Promise<void> {
  await schedulerStore.refresh()
}

// 创建任务成功
function handleTaskCreated(): void {
  showCreateModal.value = false
}

// 统计卡片数据
const statCards = computed(() => [
  {
    label: '总任务',
    value: schedulerStore.stats.totalTasks,
    icon: '📋',
    color: 'var(--text-primary)'
  },
  {
    label: '执行中',
    value: schedulerStore.stats.runningTasks,
    icon: '⚡',
    color: 'var(--bio-cyan)'
  },
  {
    label: '已完成',
    value: schedulerStore.stats.completedTasks,
    icon: '✅',
    color: 'var(--success)'
  },
  {
    label: '活跃 Agent',
    value: `${schedulerStore.stats.activeAgents}/${schedulerStore.stats.totalAgents}`,
    icon: '🤖',
    color: '#8b5cf6'
  }
])

// 初始化
onMounted(async () => {
  await schedulerStore.refresh()
  
  // 定时刷新
  if (refreshInterval.value > 0) {
    refreshTimer = setInterval(() => {
      schedulerStore.refresh()
    }, refreshInterval.value * 1000)
  }
})

// 清理
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  schedulerStore.disconnectWebSocket()
})
</script>

<template>
  <div class="scheduler-view">
    <!-- 头部 -->
    <div class="view-header">
      <div class="header-title">
        <h1>🎯 任务调度中心</h1>
        <p class="subtitle">
          多 Agent 协同调度 · 实时任务追踪
        </p>
      </div>
      
      <div class="header-actions">
        <!-- 创建任务按钮 -->
        <button class="create-btn" @click="showCreateModal = true">
          <span class="icon">➕</span>
          <span>创建任务</span>
        </button>
        
        <!-- 刷新按钮 -->
        <button 
          class="refresh-btn" 
          :disabled="schedulerStore.loading"
          @click="handleRefresh"
        >
          {{ schedulerStore.loading ? '⏳' : '🔄' }}
        </button>
      </div>
    </div>
    
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div 
        v-for="stat in statCards" 
        :key="stat.label" 
        class="stat-card"
      >
        <span class="stat-icon">{{ stat.icon }}</span>
        <div class="stat-content">
          <span class="stat-value" :style="{ color: stat.color }">
            {{ stat.value }}
          </span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </div>
    
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <!-- 视图切换 -->
        <div class="view-tabs">
          <button 
            class="view-tab" 
            :class="{ active: viewMode === 'kanban' }"
            @click="viewMode = 'kanban'"
          >
            📊 看板
          </button>
          <button 
            class="view-tab" 
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'"
          >
            📋 列表
          </button>
        </div>
      </div>
      
      <div class="toolbar-right">
        <!-- 筛选按钮 -->
        <div class="filter-wrapper">
          <button 
            class="filter-btn"
            :class="{ active: showFilterMenu }"
            @click="showFilterMenu = !showFilterMenu"
          >
            🔍 筛选
          </button>
          
          <!-- 筛选下拉菜单 -->
          <div v-if="showFilterMenu" class="filter-menu">
            <div class="filter-group">
              <label>状态</label>
              <select v-model="filterStatus">
                <option value="">全部</option>
                <option value="pending">等待中</option>
                <option value="assigned">已分配</option>
                <option value="running">执行中</option>
                <option value="completed">已完成</option>
                <option value="failed">失败</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label>类型</label>
              <select v-model="filterType">
                <option value="">全部</option>
                <option value="research">研究分析</option>
                <option value="writing">内容创作</option>
                <option value="coding">代码开发</option>
                <option value="testing">测试验证</option>
                <option value="design">设计创意</option>
                <option value="data">数据处理</option>
                <option value="translate">翻译</option>
                <option value="general">通用任务</option>
              </select>
            </div>
            
            <div class="filter-group">
              <label>优先级</label>
              <select v-model="filterPriority">
                <option value="">全部</option>
                <option value="urgent">紧急</option>
                <option value="high">高</option>
                <option value="normal">普通</option>
                <option value="low">低</option>
              </select>
            </div>
            
            <div class="filter-actions">
              <button class="apply-btn" @click="applyFilters">应用</button>
              <button class="clear-btn" @click="clearFilters">清除</button>
            </div>
          </div>
        </div>
        
        <!-- 更新时间 -->
        <span v-if="schedulerStore.lastUpdated" class="last-updated">
          更新于 {{ schedulerStore.lastUpdated }}
        </span>
      </div>
    </div>
    
    <!-- 主内容区 -->
    <div class="main-content">
      <!-- Agent 面板 -->
      <aside class="agent-sidebar">
        <AgentPanel 
          :agents="schedulerStore.agents"
          :workload="schedulerStore.agentWorkload"
        />
      </aside>
      
      <!-- 任务看板/列表 -->
      <main class="task-area">
        <TaskKanban 
          v-if="viewMode === 'kanban'"
          :tasks-by-status="schedulerStore.tasksByStatus"
          :loading="schedulerStore.loading"
          @create="showCreateModal = true"
        />
        
        <!-- 列表视图 -->
        <div v-else class="task-list-view">
          <div v-if="schedulerStore.filteredTasks.length === 0" class="empty-state">
            <p>暂无任务</p>
            <button class="create-btn" @click="showCreateModal = true">
              创建第一个任务
            </button>
          </div>
          
          <div v-else class="task-list">
            <div 
              v-for="task in schedulerStore.filteredTasks" 
              :key="task.id" 
              class="task-row"
              @click="schedulerStore.selectTask(task.id)"
            >
              <span class="task-title">{{ task.title }}</span>
              <span class="task-type">{{ task.type }}</span>
              <span class="task-priority">{{ task.priority }}</span>
              <span class="task-status">{{ task.status }}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
    
    <!-- 创建任务弹窗 -->
    <CreateTaskModal 
      v-if="showCreateModal"
      :agents="schedulerStore.agents"
      @close="showCreateModal = false"
      @created="handleTaskCreated"
    />
  </div>
</template>

<style scoped>
.scheduler-view {
  padding: 1.5rem;
  max-width: 1600px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

/* 头部 */
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.header-title h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--abyss-black);
  background: var(--bio-cyan);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.create-btn:hover {
  background: #00d4e6;
  transform: translateY(-1px);
}

.refresh-btn {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.refresh-btn:hover:not(:disabled) {
  border-color: var(--bio-cyan);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: var(--font-mono);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* 视图切换 */
.view-tabs {
  display: flex;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.view-tab {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.view-tab:hover {
  color: var(--text-primary);
}

.view-tab.active {
  background: var(--bio-cyan);
  color: var(--abyss-black);
}

/* 筛选 */
.filter-wrapper {
  position: relative;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-primary);
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-btn:hover,
.filter-btn.active {
  border-color: var(--bio-cyan);
}

.filter-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  padding: 1rem;
  background: var(--ocean-dark);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  min-width: 200px;
  z-index: 100;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.filter-group {
  margin-bottom: 0.75rem;
}

.filter-group label {
  display: block;
  font-size: 0.625rem;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.filter-group select {
  width: 100%;
  padding: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-primary);
  background: var(--abyss-black);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.apply-btn,
.clear-btn {
  flex: 1;
  padding: 0.375rem;
  font-size: 0.75rem;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.apply-btn {
  color: var(--abyss-black);
  background: var(--bio-cyan);
}

.clear-btn {
  color: var(--text-primary);
  background: transparent;
  border: 1px solid var(--border-glass);
}

.last-updated {
  font-size: 0.625rem;
  color: var(--text-muted);
  white-space: nowrap;
}

/* 主内容区 */
.main-content {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
  min-height: 500px;
}

@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .agent-sidebar {
    order: 2;
  }
}

.agent-sidebar {
  flex-shrink: 0;
}

.task-area {
  min-width: 0;
}

/* 列表视图 */
.task-list-view {
  background: rgba(10, 17, 40, 0.6);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius);
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-state p {
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.task-list {
  max-height: 600px;
  overflow-y: auto;
}

.task-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-glass);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.task-row:hover {
  background: rgba(0, 245, 255, 0.05);
}

.task-row:last-child {
  border-bottom: none;
}

.task-title {
  font-size: 0.875rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-type,
.task-priority,
.task-status {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* 响应式 */
@media (max-width: 768px) {
  .scheduler-view {
    padding: 1rem;
  }
  
  .view-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .header-actions {
    width: 100%;
  }
  
  .create-btn {
    flex: 1;
    justify-content: center;
  }
}
</style>