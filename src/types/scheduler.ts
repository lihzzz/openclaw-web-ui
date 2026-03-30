/**
 * 多 Agent 调度系统类型定义
 */

// ===== Agent 能力定义 =====

/**
 * Agent 能力类型
 */
export type AgentCapability = 
  | 'research'    // 研究分析
  | 'writing'     // 内容创作
  | 'coding'      // 代码开发
  | 'testing'     // 测试验证
  | 'design'      // 设计创意
  | 'data'        // 数据处理
  | 'translate'   // 翻译
  | 'general'     // 通用任务

/**
 * Agent 能力信息
 */
export interface CapabilityInfo {
  type: AgentCapability
  name: string
  description: string
  icon: string
}

/**
 * 调度 Agent 定义
 */
export interface SchedulerAgent {
  id: string
  name: string
  emoji: string
  capabilities: AgentCapability[]
  status: 'idle' | 'busy' | 'offline'
  currentTaskId?: string
  completedTasks: number
  failedTasks: number
  lastActive?: number
  model?: string
}

// ===== 任务定义 =====

/**
 * 任务优先级
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * 任务状态
 */
export type TaskStatus = 
  | 'pending'     // 等待分配
  | 'assigned'    // 已分配
  | 'running'     // 执行中
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'cancelled'   // 已取消

/**
 * 任务进度
 */
export interface TaskProgress {
  percentage: number      // 0-100
  message?: string        // 当前步骤描述
  startTime?: number      // 开始时间
  estimatedEnd?: number   // 预计结束时间
}

/**
 * 任务执行步骤
 */
export interface TaskStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: number
  endTime?: number
  output?: string
  error?: string
}

/**
 * 调度任务定义
 */
export interface SchedulerTask {
  id: string
  title: string
  description: string
  type: AgentCapability
  priority: TaskPriority
  status: TaskStatus
  progress: TaskProgress
  assignedAgentId?: string
  createdAt: number
  updatedAt: number
  startedAt?: number
  completedAt?: number
  deadline?: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  steps?: TaskStep[]
  dependencies?: string[]  // 依赖的任务 ID
  tags?: string[]
}

// ===== 任务队列 =====

/**
 * 任务队列项
 */
export interface TaskQueueItem {
  task: SchedulerTask
  addedAt: number
  retryCount: number
  maxRetries: number
}

// ===== 调度策略 =====

/**
 * 任务分配策略
 */
export type AssignmentStrategy = 
  | 'round-robin'     // 轮询
  | 'least-loaded'    // 最少负载
  | 'capability'      // 能力匹配优先
  | 'priority'        // 优先级优先

/**
 * 调度配置
 */
export interface SchedulerConfig {
  strategy: AssignmentStrategy
  maxConcurrentTasks: number
  taskTimeout: number       // 任务超时时间（毫秒）
  retryDelay: number        // 重试延迟
  maxRetries: number        // 最大重试次数
}

// ===== 统计数据 =====

/**
 * 调度统计
 */
export interface SchedulerStats {
  totalTasks: number
  pendingTasks: number
  runningTasks: number
  completedTasks: number
  failedTasks: number
  avgCompletionTime: number
  throughput: number        // 每小时完成任务数
  activeAgents: number
  totalAgents: number
}

/**
 * Agent 统计
 */
export interface AgentStats {
  agentId: string
  tasksCompleted: number
  tasksFailed: number
  avgTaskTime: number
  successRate: number
  totalWorkTime: number
}

// ===== API 响应类型 =====

/**
 * 任务列表响应
 */
export interface TaskListResponse {
  tasks: SchedulerTask[]
  total: number
  stats: SchedulerStats
}

/**
 * Agent 列表响应
 */
export interface AgentListResponse {
  agents: SchedulerAgent[]
  stats: {
    active: number
    idle: number
    offline: number
  }
}

/**
 * 创建任务请求
 */
export interface CreateTaskRequest {
  title: string
  description: string
  type: AgentCapability
  priority?: TaskPriority
  deadline?: number
  input?: Record<string, unknown>
  dependencies?: string[]
  tags?: string[]
  assignedAgentId?: string  // 可选：指定 agent
}

/**
 * 更新任务请求
 */
export interface UpdateTaskRequest {
  title?: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  progress?: Partial<TaskProgress>
  output?: Record<string, unknown>
  error?: string
}

// ===== WebSocket 事件 =====

/**
 * 调度事件类型
 */
export type SchedulerEventType = 
  | 'task.created'
  | 'task.assigned'
  | 'task.started'
  | 'task.progress'
  | 'task.completed'
  | 'task.failed'
  | 'agent.status'
  | 'agent.task'

/**
 * 调度事件
 */
export interface SchedulerEvent {
  type: SchedulerEventType
  payload: {
    task?: SchedulerTask
    agent?: SchedulerAgent
    progress?: TaskProgress
    timestamp: number
  }
}

// ===== 能力信息映射 =====

export const CAPABILITY_INFO: Record<AgentCapability, CapabilityInfo> = {
  research: {
    type: 'research',
    name: '研究分析',
    description: '信息搜集、数据分析、研究报告',
    icon: '🔍'
  },
  writing: {
    type: 'writing',
    name: '内容创作',
    description: '文章撰写、文案创作、内容编辑',
    icon: '✍️'
  },
  coding: {
    type: 'coding',
    name: '代码开发',
    description: '编程开发、代码审查、技术实现',
    icon: '💻'
  },
  testing: {
    type: 'testing',
    name: '测试验证',
    description: '功能测试、质量验证、问题排查',
    icon: '🧪'
  },
  design: {
    type: 'design',
    name: '设计创意',
    description: 'UI设计、视觉创作、交互设计',
    icon: '🎨'
  },
  data: {
    type: 'data',
    name: '数据处理',
    description: '数据清洗、数据分析、报表生成',
    icon: '📊'
  },
  translate: {
    type: 'translate',
    name: '翻译',
    description: '多语言翻译、本地化',
    icon: '🌐'
  },
  general: {
    type: 'general',
    name: '通用任务',
    description: '通用任务处理',
    icon: '📋'
  }
}

// ===== 优先级映射 =====

export const PRIORITY_INFO: Record<TaskPriority, { label: string; color: string; icon: string }> = {
  low: { label: '低', color: '#6b7280', icon: '⬇️' },
  normal: { label: '普通', color: '#3b82f6', icon: '➡️' },
  high: { label: '高', color: '#f59e0b', icon: '⬆️' },
  urgent: { label: '紧急', color: '#ef4444', icon: '🔴' }
}

// ===== 状态映射 =====

export const STATUS_INFO: Record<TaskStatus, { label: string; color: string; icon: string }> = {
  pending: { label: '等待中', color: '#6b7280', icon: '⏳' },
  assigned: { label: '已分配', color: '#8b5cf6', icon: '👤' },
  running: { label: '执行中', color: '#3b82f6', icon: '⚡' },
  completed: { label: '已完成', color: '#10b981', icon: '✅' },
  failed: { label: '失败', color: '#ef4444', icon: '❌' },
  cancelled: { label: '已取消', color: '#9ca3af', icon: '🚫' }
}