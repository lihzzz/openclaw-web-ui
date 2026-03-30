import { Router } from 'express'
import type { Request, Response } from 'express'
import type {
  SchedulerTask,
  SchedulerAgent,
  TaskStatus,
  AgentCapability,
  CreateTaskRequest,
  UpdateTaskRequest
} from '../../src/types/scheduler.js'

const router = Router()

// ===== 内存数据存储 =====
// 生产环境应使用数据库

let tasks: SchedulerTask[] = []
let agents: SchedulerAgent[] = [
  {
    id: 'research-agent',
    name: '研究分析 Agent',
    emoji: '🔍',
    capabilities: ['research', 'data'],
    status: 'idle',
    completedTasks: 0,
    failedTasks: 0,
    model: 'gpt-4'
  },
  {
    id: 'writing-agent',
    name: '内容创作 Agent',
    emoji: '✍️',
    capabilities: ['writing', 'translate'],
    status: 'idle',
    completedTasks: 0,
    failedTasks: 0,
    model: 'claude-3'
  },
  {
    id: 'coding-agent',
    name: '代码开发 Agent',
    emoji: '💻',
    capabilities: ['coding', 'testing'],
    status: 'idle',
    completedTasks: 0,
    failedTasks: 0,
    model: 'gpt-4'
  },
  {
    id: 'design-agent',
    name: '设计创意 Agent',
    emoji: '🎨',
    capabilities: ['design'],
    status: 'idle',
    completedTasks: 0,
    failedTasks: 0,
    model: 'dall-e-3'
  },
  {
    id: 'general-agent',
    name: '通用任务 Agent',
    emoji: '📋',
    capabilities: ['general', 'testing', 'data'],
    status: 'idle',
    completedTasks: 0,
    failedTasks: 0,
    model: 'gpt-3.5-turbo'
  }
]

let taskIdCounter = 1

// ===== 辅助函数 =====

function generateTaskId(): string {
  return `task-${Date.now()}-${taskIdCounter++}`
}

function findBestAgent(type: AgentCapability): SchedulerAgent | null {
  // 找到有能力处理该类型任务的空闲 agent
  const capableAgents = agents.filter(
    a => a.capabilities.includes(type) && a.status === 'idle'
  )
  
  if (capableAgents.length === 0) {
    // 尝试找通用 agent
    const generalAgent = agents.find(
      a => a.capabilities.includes('general') && a.status === 'idle'
    )
    return generalAgent || null
  }
  
  // 选择完成任务最多的 agent
  return capableAgents.reduce((best, current) => 
    current.completedTasks > best.completedTasks ? current : best
  )
}

function updateAgentStatus(agentId: string, status: 'idle' | 'busy'): void {
  const agent = agents.find(a => a.id === agentId)
  if (agent) {
    agent.status = status
    agent.lastActive = Date.now()
  }
}

// ===== 任务 API =====

/**
 * 获取任务列表
 */
router.get('/tasks', (req: Request, res: Response) => {
  const status = req.query.status as TaskStatus | undefined
  const type = req.query.type as AgentCapability | undefined
  const agentId = req.query.agentId as string | undefined
  
  let filtered = [...tasks]
  
  if (status) {
    filtered = filtered.filter(t => t.status === status)
  }
  if (type) {
    filtered = filtered.filter(t => t.type === type)
  }
  if (agentId) {
    filtered = filtered.filter(t => t.assignedAgentId === agentId)
  }
  
  // 计算统计
  const stats = {
    totalTasks: tasks.length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    runningTasks: tasks.filter(t => t.status === 'running').length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    failedTasks: tasks.filter(t => t.status === 'failed').length,
    avgCompletionTime: 0,
    throughput: 0,
    activeAgents: agents.filter(a => a.status !== 'offline').length,
    totalAgents: agents.length
  }
  
  res.json({ tasks: filtered, total: filtered.length, stats })
})

/**
 * 获取单个任务
 */
router.get('/tasks/:id', (req: Request, res: Response) => {
  const task = tasks.find(t => t.id === req.params.id)
  
  if (!task) {
    res.status(404).json({ error: '任务不存在' })
    return
  }
  
  res.json({ task })
})

/**
 * 创建任务
 */
router.post('/tasks', (req: Request, res: Response) => {
  const request: CreateTaskRequest = req.body
  
  if (!request.title || !request.type) {
    res.status(400).json({ error: '缺少必要字段' })
    return
  }
  
  const now = Date.now()
  
  const task: SchedulerTask = {
    id: generateTaskId(),
    title: request.title,
    description: request.description || '',
    type: request.type,
    priority: request.priority || 'normal',
    status: 'pending',
    progress: {
      percentage: 0,
      message: '等待分配'
    },
    assignedAgentId: request.assignedAgentId,
    createdAt: now,
    updatedAt: now,
    deadline: request.deadline,
    input: request.input,
    dependencies: request.dependencies,
    tags: request.tags
  }
  
  // 如果指定了 agent，直接分配
  if (request.assignedAgentId) {
    const agent = agents.find(a => a.id === request.assignedAgentId)
    if (agent) {
      task.status = 'assigned'
      task.assignedAgentId = request.assignedAgentId
      updateAgentStatus(request.assignedAgentId, 'busy')
      agent.currentTaskId = task.id
    }
  }
  
  tasks.push(task)
  
  res.status(201).json({ task })
})

/**
 * 更新任务
 */
router.patch('/tasks/:id', (req: Request, res: Response) => {
  const taskId = req.params.id
  const request: UpdateTaskRequest = req.body
  
  const taskIndex = tasks.findIndex(t => t.id === taskId)
  
  if (taskIndex < 0) {
    res.status(404).json({ error: '任务不存在' })
    return
  }
  
  const task = tasks[taskIndex]
  
  // 更新字段
  if (request.title) task.title = request.title
  if (request.description) task.description = request.description
  if (request.priority) task.priority = request.priority
  if (request.progress) {
    task.progress = { ...task.progress, ...request.progress }
  }
  if (request.output) task.output = request.output
  if (request.error !== undefined) task.error = request.error
  
  // 状态变更
  if (request.status && request.status !== task.status) {
    const oldStatus = task.status
    task.status = request.status
    
    // 状态变更处理
    if (request.status === 'running') {
      task.startedAt = Date.now()
      task.progress.message = '执行中...'
    } else if (request.status === 'completed') {
      task.completedAt = Date.now()
      task.progress.percentage = 100
      task.progress.message = '已完成'
      
      // 更新 agent 统计
      if (task.assignedAgentId) {
        const agent = agents.find(a => a.id === task.assignedAgentId)
        if (agent) {
          agent.completedTasks++
          agent.currentTaskId = undefined
          updateAgentStatus(agent.id, 'idle')
        }
      }
    } else if (request.status === 'failed') {
      if (task.assignedAgentId) {
        const agent = agents.find(a => a.id === task.assignedAgentId)
        if (agent) {
          agent.failedTasks++
          agent.currentTaskId = undefined
          updateAgentStatus(agent.id, 'idle')
        }
      }
    } else if (request.status === 'cancelled') {
      if (task.assignedAgentId) {
        const agent = agents.find(a => a.id === task.assignedAgentId)
        if (agent) {
          agent.currentTaskId = undefined
          updateAgentStatus(agent.id, 'idle')
        }
      }
    }
  }
  
  task.updatedAt = Date.now()
  tasks[taskIndex] = task
  
  res.json({ task })
})

/**
 * 删除任务
 */
router.delete('/tasks/:id', (req: Request, res: Response) => {
  const taskId = req.params.id
  const taskIndex = tasks.findIndex(t => t.id === taskId)
  
  if (taskIndex < 0) {
    res.status(404).json({ error: '任务不存在' })
    return
  }
  
  const task = tasks[taskIndex]
  
  // 如果任务正在执行，释放 agent
  if (task.assignedAgentId && (task.status === 'running' || task.status === 'assigned')) {
    const agent = agents.find(a => a.id === task.assignedAgentId)
    if (agent) {
      agent.currentTaskId = undefined
      updateAgentStatus(agent.id, 'idle')
    }
  }
  
  tasks.splice(taskIndex, 1)
  
  res.json({ ok: true })
})

/**
 * 分配任务
 */
router.post('/tasks/:id/assign', (req: Request, res: Response) => {
  const taskId = req.params.id
  const { agentId } = req.body
  
  const task = tasks.find(t => t.id === taskId)
  const agent = agents.find(a => a.id === agentId)
  
  if (!task) {
    res.status(404).json({ error: '任务不存在' })
    return
  }
  
  if (!agent) {
    res.status(404).json({ error: 'Agent 不存在' })
    return
  }
  
  if (agent.status !== 'idle') {
    res.status(400).json({ error: 'Agent 正忙' })
    return
  }
  
  // 分配任务
  task.assignedAgentId = agentId
  task.status = 'assigned'
  task.updatedAt = Date.now()
  
  agent.status = 'busy'
  agent.currentTaskId = taskId
  
  res.json({ task, agent })
})

/**
 * 自动分配任务
 */
router.post('/tasks/:id/auto-assign', (req: Request, res: Response) => {
  const taskId = req.params.id
  const task = tasks.find(t => t.id === taskId)
  
  if (!task) {
    res.status(404).json({ error: '任务不存在' })
    return
  }
  
  const agent = findBestAgent(task.type)
  
  if (!agent) {
    res.status(400).json({ error: '没有可用的 Agent' })
    return
  }
  
  // 分配任务
  task.assignedAgentId = agent.id
  task.status = 'assigned'
  task.updatedAt = Date.now()
  
  agent.status = 'busy'
  agent.currentTaskId = taskId
  
  res.json({ task, agent })
})

/**
 * 开始执行任务
 */
router.post('/tasks/:id/start', (req: Request, res: Response) => {
  const taskId = req.params.id
  const task = tasks.find(t => t.id === taskId)
  
  if (!task) {
    res.status(404).json({ error: '任务不存在' })
    return
  }
  
  if (task.status !== 'assigned' && task.status !== 'pending') {
    res.status(400).json({ error: '任务状态不允许启动' })
    return
  }
  
  task.status = 'running'
  task.startedAt = Date.now()
  task.updatedAt = Date.now()
  task.progress.message = '执行中...'
  
  res.json({ task })
})

// ===== Agent API =====

/**
 * 获取 Agent 列表
 */
router.get('/agents', (req: Request, res: Response) => {
  res.json({
    agents,
    stats: {
      active: agents.filter(a => a.status !== 'offline').length,
      idle: agents.filter(a => a.status === 'idle').length,
      busy: agents.filter(a => a.status === 'busy').length,
      offline: agents.filter(a => a.status === 'offline').length
    }
  })
})

/**
 * 获取单个 Agent
 */
router.get('/agents/:id', (req: Request, res: Response) => {
  const agent = agents.find(a => a.id === req.params.id)
  
  if (!agent) {
    res.status(404).json({ error: 'Agent 不存在' })
    return
  }
  
  // 获取该 agent 的任务
  const agentTasks = tasks.filter(t => t.assignedAgentId === agent.id)
  
  res.json({ agent, tasks: agentTasks })
})

/**
 * 更新 Agent 状态
 */
router.patch('/agents/:id', (req: Request, res: Response) => {
  const agentId = req.params.id
  const { status } = req.body
  
  const agent = agents.find(a => a.id === agentId)
  
  if (!agent) {
    res.status(404).json({ error: 'Agent 不存在' })
    return
  }
  
  if (status) {
    agent.status = status
    agent.lastActive = Date.now()
  }
  
  res.json({ agent })
})

/**
 * 注册新 Agent
 */
router.post('/agents', (req: Request, res: Response) => {
  const { id, name, emoji, capabilities, model } = req.body
  
  if (!id || !name || !capabilities) {
    res.status(400).json({ error: '缺少必要字段' })
    return
  }
  
  // 检查是否已存在
  if (agents.find(a => a.id === id)) {
    res.status(400).json({ error: 'Agent ID 已存在' })
    return
  }
  
  const agent: SchedulerAgent = {
    id,
    name,
    emoji: emoji || '🤖',
    capabilities,
    status: 'idle',
    completedTasks: 0,
    failedTasks: 0,
    model
  }
  
  agents.push(agent)
  
  res.status(201).json({ agent })
})

/**
 * 删除 Agent
 */
router.delete('/agents/:id', (req: Request, res: Response) => {
  const agentId = req.params.id
  const agentIndex = agents.findIndex(a => a.id === agentId)
  
  if (agentIndex < 0) {
    res.status(404).json({ error: 'Agent 不存在' })
    return
  }
  
  // 检查是否有正在执行的任务
  const runningTask = tasks.find(
    t => t.assignedAgentId === agentId && t.status === 'running'
  )
  
  if (runningTask) {
    res.status(400).json({ error: 'Agent 正在执行任务，无法删除' })
    return
  }
  
  agents.splice(agentIndex, 1)
  
  res.json({ ok: true })
})

// ===== 统计 API =====

/**
 * 获取调度统计
 */
router.get('/stats', (req: Request, res: Response) => {
  const completedTasks = tasks.filter(t => t.status === 'completed')
  
  const avgCompletionTime = completedTasks.length > 0
    ? completedTasks.reduce((sum, t) => {
        if (t.startedAt && t.completedAt) {
          return sum + (t.completedAt - t.startedAt)
        }
        return sum
      }, 0) / completedTasks.length
    : 0
  
  res.json({
    tasks: {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      assigned: tasks.filter(t => t.status === 'assigned').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: completedTasks.length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    },
    agents: {
      total: agents.length,
      active: agents.filter(a => a.status !== 'offline').length,
      idle: agents.filter(a => a.status === 'idle').length,
      busy: agents.filter(a => a.status === 'busy').length
    },
    performance: {
      avgCompletionTime,
      throughput: 0 // TODO: 计算每小时完成任务数
    }
  })
})

export default router