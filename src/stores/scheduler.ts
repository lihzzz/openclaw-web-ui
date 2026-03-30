import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  SchedulerTask,
  SchedulerAgent,
  TaskStatus,
  TaskPriority,
  AgentCapability,
  SchedulerStats,
  CreateTaskRequest,
  UpdateTaskRequest,
  SchedulerEvent
} from '@/types/scheduler'

/**
 * 多 Agent 调度系统 Store
 */
export const useSchedulerStore = defineStore('scheduler', () => {
  // === 状态 ===
  
  // Agent 列表
  const agents = ref<SchedulerAgent[]>([])
  
  // 任务列表
  const tasks = ref<SchedulerTask[]>([])
  
  // 加载状态
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  // 最后更新时间
  const lastUpdated = ref<string>('')
  
  // WebSocket 连接
  const ws = ref<WebSocket | null>(null)
  const wsConnected = ref(false)
  
  // 选中的任务（用于详情查看）
  const selectedTaskId = ref<string | null>(null)
  
  // 筛选条件
  const filters = ref({
    status: null as TaskStatus | null,
    type: null as AgentCapability | null,
    priority: null as TaskPriority | null,
    agentId: null as string | null,
    search: ''
  })
  
  // 排序
  const sortBy = ref<'createdAt' | 'updatedAt' | 'priority'>('createdAt')
  const sortOrder = ref<'asc' | 'desc'>('desc')
  
  // === 计算属性 ===
  
  // 统计数据
  const stats = computed<SchedulerStats>(() => {
    const total = tasks.value.length
    const pendingTasks = tasks.value.filter(t => t.status === 'pending').length
    const runningTasks = tasks.value.filter(t => t.status === 'running').length
    const completedTasks = tasks.value.filter(t => t.status === 'completed').length
    const failedTasks = tasks.value.filter(t => t.status === 'failed').length
    
    const completedTasksList = tasks.value.filter(t => t.status === 'completed' && t.completedAt && t.startedAt)
    const avgCompletionTime = completedTasksList.length > 0
      ? completedTasksList.reduce((sum, t) => sum + (t.completedAt! - t.startedAt!), 0) / completedTasksList.length
      : 0
    
    const activeAgents = agents.value.filter(a => a.status !== 'offline').length
    
    return {
      totalTasks: total,
      pendingTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      avgCompletionTime,
      throughput: 0, // 需要从后端计算
      activeAgents,
      totalAgents: agents.value.length
    }
  })
  
  // 按状态分组的任务（看板视图）
  const tasksByStatus = computed(() => {
    const groups: Record<TaskStatus, SchedulerTask[]> = {
      pending: [],
      assigned: [],
      running: [],
      completed: [],
      failed: [],
      cancelled: []
    }
    
    tasks.value.forEach(task => {
      groups[task.status].push(task)
    })
    
    return groups
  })
  
  // 筛选后的任务
  const filteredTasks = computed(() => {
    let result = [...tasks.value]
    
    // 应用筛选
    if (filters.value.status) {
      result = result.filter(t => t.status === filters.value.status)
    }
    if (filters.value.type) {
      result = result.filter(t => t.type === filters.value.type)
    }
    if (filters.value.priority) {
      result = result.filter(t => t.priority === filters.value.priority)
    }
    if (filters.value.agentId) {
      result = result.filter(t => t.assignedAgentId === filters.value.agentId)
    }
    if (filters.value.search) {
      const search = filters.value.search.toLowerCase()
      result = result.filter(t => 
        t.title.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      )
    }
    
    // 排序
    result.sort((a, b) => {
      let cmp = 0
      if (sortBy.value === 'priority') {
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 }
        cmp = priorityOrder[b.priority] - priorityOrder[a.priority]
      } else {
        cmp = b[sortBy.value] - a[sortBy.value]
      }
      return sortOrder.value === 'desc' ? cmp : -cmp
    })
    
    return result
  })
  
  // 选中的任务
  const selectedTask = computed(() => {
    if (!selectedTaskId.value) return null
    return tasks.value.find(t => t.id === selectedTaskId.value) || null
  })
  
  // Agent 工作负载
  const agentWorkload = computed(() => {
    const workload: Record<string, number> = {}
    agents.value.forEach(agent => {
      workload[agent.id] = tasks.value.filter(
        t => t.assignedAgentId === agent.id && 
        (t.status === 'running' || t.status === 'assigned')
      ).length
    })
    return workload
  })
  
  // === 方法 ===
  
  /**
   * 获取所有任务
   */
  async function fetchTasks(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch('/api/scheduler/tasks')
      const data = await response.json()
      
      if (data.error) {
        error.value = data.error
      } else {
        tasks.value = data.tasks || []
      }
      
      lastUpdated.value = new Date().toLocaleTimeString('zh-CN')
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取任务失败'
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 获取所有 Agent
   */
  async function fetchAgents(): Promise<void> {
    try {
      const response = await fetch('/api/scheduler/agents')
      const data = await response.json()
      
      if (data.error) {
        console.error('获取 Agent 失败:', data.error)
      } else {
        agents.value = data.agents || []
      }
    } catch (e) {
      console.error('获取 Agent 失败:', e)
    }
  }
  
  /**
   * 创建任务
   */
  async function createTask(request: CreateTaskRequest): Promise<SchedulerTask | null> {
    try {
      const response = await fetch('/api/scheduler/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      
      const data = await response.json()
      
      if (data.error) {
        error.value = data.error
        return null
      }
      
      // 添加到本地列表
      if (data.task) {
        tasks.value.push(data.task)
      }
      
      return data.task
    } catch (e) {
      error.value = e instanceof Error ? e.message : '创建任务失败'
      return null
    }
  }
  
  /**
   * 更新任务
   */
  async function updateTask(taskId: string, request: UpdateTaskRequest): Promise<boolean> {
    try {
      const response = await fetch(`/api/scheduler/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      
      const data = await response.json()
      
      if (data.error) {
        error.value = data.error
        return false
      }
      
      // 更新本地状态
      if (data.task) {
        const index = tasks.value.findIndex(t => t.id === taskId)
        if (index >= 0) {
          tasks.value[index] = data.task
        }
      }
      
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '更新任务失败'
      return false
    }
  }
  
  /**
   * 删除任务
   */
  async function deleteTask(taskId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/scheduler/tasks/${taskId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.error) {
        error.value = data.error
        return false
      }
      
      // 从本地列表移除
      tasks.value = tasks.value.filter(t => t.id !== taskId)
      
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '删除任务失败'
      return false
    }
  }
  
  /**
   * 分配任务给 Agent
   */
  async function assignTask(taskId: string, _agentId: string): Promise<boolean> {
    return updateTask(taskId, { status: 'assigned' })
  }
  
  /**
   * 取消任务
   */
  async function cancelTask(taskId: string): Promise<boolean> {
    return updateTask(taskId, { status: 'cancelled' })
  }
  
  /**
   * 重试失败的任务
   */
  async function retryTask(taskId: string): Promise<boolean> {
    return updateTask(taskId, { status: 'pending', error: undefined })
  }
  
  /**
   * 刷新所有数据
   */
  async function refresh(): Promise<void> {
    await Promise.all([fetchTasks(), fetchAgents()])
  }
  
  /**
   * 连接 WebSocket
   */
  function connectWebSocket(url?: string): void {
    if (ws.value?.readyState === WebSocket.OPEN) {
      return
    }
    
    const wsUrl = url || `ws://${window.location.host}/api/scheduler/ws`
    
    try {
      ws.value = new WebSocket(wsUrl)
      
      ws.value.onopen = () => {
        wsConnected.value = true
      }
      
      ws.value.onmessage = (event) => {
        try {
          const data: SchedulerEvent = JSON.parse(event.data)
          handleSchedulerEvent(data)
        } catch {
          // 忽略解析错误
        }
      }
      
      ws.value.onclose = () => {
        wsConnected.value = false
        // 自动重连
        setTimeout(() => connectWebSocket(url), 3000)
      }
      
      ws.value.onerror = () => {
        wsConnected.value = false
      }
    } catch {
      wsConnected.value = false
    }
  }
  
  /**
   * 断开 WebSocket
   */
  function disconnectWebSocket(): void {
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    wsConnected.value = false
  }
  
  /**
   * 处理调度事件
   */
  function handleSchedulerEvent(event: SchedulerEvent): void {
    const { type, payload } = event
    
    switch (type) {
      case 'task.created':
      case 'task.assigned':
      case 'task.started':
      case 'task.completed':
      case 'task.failed':
        if (payload.task) {
          const index = tasks.value.findIndex(t => t.id === payload.task!.id)
          if (index >= 0) {
            tasks.value[index] = payload.task
          } else {
            tasks.value.push(payload.task)
          }
        }
        break
        
      case 'task.progress':
        if (payload.task) {
          const index = tasks.value.findIndex(t => t.id === payload.task!.id)
          if (index >= 0) {
            tasks.value[index].progress = payload.task.progress
          }
        }
        break
        
      case 'agent.status':
      case 'agent.task':
        if (payload.agent) {
          const index = agents.value.findIndex(a => a.id === payload.agent!.id)
          if (index >= 0) {
            agents.value[index] = payload.agent
          } else {
            agents.value.push(payload.agent)
          }
        }
        break
    }
    
    lastUpdated.value = new Date().toLocaleTimeString('zh-CN')
  }
  
  /**
   * 设置筛选条件
   */
  function setFilter(key: keyof typeof filters.value, value: string | null): void {
    filters.value[key] = value as never
  }
  
  /**
   * 清除筛选条件
   */
  function clearFilters(): void {
    filters.value = {
      status: null,
      type: null,
      priority: null,
      agentId: null,
      search: ''
    }
  }
  
  /**
   * 设置排序
   */
  function setSorting(by: typeof sortBy.value, order: typeof sortOrder.value): void {
    sortBy.value = by
    sortOrder.value = order
  }
  
  /**
   * 选择任务
   */
  function selectTask(taskId: string | null): void {
    selectedTaskId.value = taskId
  }
  
  return {
    // 状态
    agents,
    tasks,
    loading,
    error,
    lastUpdated,
    wsConnected,
    selectedTaskId,
    filters,
    sortBy,
    sortOrder,
    
    // 计算属性
    stats,
    tasksByStatus,
    filteredTasks,
    selectedTask,
    agentWorkload,
    
    // 方法
    fetchTasks,
    fetchAgents,
    createTask,
    updateTask,
    deleteTask,
    assignTask,
    cancelTask,
    retryTask,
    refresh,
    connectWebSocket,
    disconnectWebSocket,
    setFilter,
    clearFilters,
    setSorting,
    selectTask
  }
})