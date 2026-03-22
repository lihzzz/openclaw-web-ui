/**
 * 消息类型
 */
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  runId?: string
  toolCalls?: ToolCall[]
}

/**
 * 工具调用类型
 */
export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  output?: string
  error?: string
  status: 'pending' | 'running' | 'success' | 'error'
}

/**
 * 设置类型
 */
export interface Settings {
  host: string
  port: number
  token: string
  dangerouslyDisableDeviceAuth?: boolean
  reconnectInterval?: number
  connectionTimeout?: number
}

/**
 * WebSocket 连接状态
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'authenticating'

/**
 * WebSocket 关闭原因映射
 */
export const WEBSOCKET_CLOSE_REASONS: Record<number, string> = {
  1002: '协议错误',
  1003: '不支持的数据类型',
  1006: '连接异常关闭（可能是服务器未运行）',
  1007: '数据类型不一致',
  1008: '策略违规',
  1009: '消息过大',
  1010: '扩展协商失败',
  1011: '内部服务器错误',
  1015: 'TLS 握手失败'
}

// ===== Agent 相关类型 =====

/**
 * Agent 平台配置
 */
export interface AgentPlatform {
  name: string
  accountId?: string
  appId?: string
  botOpenId?: string
  botUserId?: string
}

/**
 * Agent 会话状态
 */
export interface AgentSession {
  lastActive: number | null
  totalTokens: number
  contextTokens: number
  sessionCount: number
  todayAvgResponseMs: number
  messageCount: number
  weeklyResponseMs: number[]
  weeklyTokens: number[]
}

/**
 * Agent 配置
 */
export interface Agent {
  id: string
  name: string
  emoji: string
  model: string
  platforms: AgentPlatform[]
  session?: AgentSession
}

/**
 * Agent 状态
 */
export type AgentState = 'working' | 'online' | 'idle' | 'offline'

/**
 * Agent 状态信息
 */
export interface AgentStatus {
  agentId: string
  state: AgentState
  lastActive: number | null
}

/**
 * 模型提供商
 */
export interface ModelProvider {
  id: string
  api?: string
  accessMode?: 'auth' | 'api_key'
  models: Array<{
    id: string
    name?: string
    contextWindow?: number
    maxTokens?: number
    reasoning?: boolean
    input?: string[]
  }>
  usedBy?: Array<{ id: string; emoji: string; name: string }>
}

/**
 * Gateway 配置
 */
export interface GatewayConfig {
  port: number
  token?: string
  host?: string
}

/**
 * 群聊配置
 */
export interface GroupChat {
  groupId: string
  channel: string
  agents: Array<{ id: string; emoji: string; name: string }>
}

/**
 * 配置数据（API 响应）
 */
export interface ConfigData {
  agents: Agent[]
  providers: ModelProvider[]
  defaults: {
    model: string
    fallbacks: string[]
  }
  gateway: GatewayConfig
  groupChats?: GroupChat[]
  error?: string
}

/**
 * 每日统计数据
 */
export interface DayStat {
  date: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  messageCount: number
  avgResponseMs: number
}

/**
 * 所有统计数据
 */
export interface AllStats {
  daily: DayStat[]
  weekly: DayStat[]
  monthly: DayStat[]
}

/**
 * 测试结果
 */
export interface TestResult {
  ok: boolean
  error?: string
  elapsed: number
}

/**
 * Agent 测试结果
 */
export interface AgentTestResult extends TestResult {
  agentId: string
  text?: string
}

/**
 * 平台测试结果
 */
export interface PlatformTestResult extends TestResult {
  agentId: string
  platform: string
  reply?: string
  detail?: string
}

/**
 * 会话测试结果
 */
export interface SessionTestResult extends TestResult {
  agentId: string
  reply?: string
}

// ===== Session 相关类型 =====

/**
 * 会话信息
 */
export interface Session {
  key: string
  type: string
  target: string
  sessionId: string | null
  updatedAt: number
  totalTokens: number
  contextTokens: number
  systemSent: boolean
}

/**
 * 会话类型配置
 */
export interface SessionTypeInfo {
  emoji: string
  color: string
  label: string
}

/**
 * 会话测试状态
 */
export interface SessionTestStatus {
  status: 'testing' | 'ok' | 'error'
  elapsed?: number
  reply?: string
  error?: string
}

// ===== Model 相关类型 =====

/**
 * 模型信息
 */
export interface Model {
  id: string
  name: string
  contextWindow?: number
  maxTokens?: number
  reasoning?: boolean
  input?: string[]
}

/**
 * 模型提供商（完整）
 */
export interface Provider {
  id: string
  api?: string
  accessMode?: 'auth' | 'api_key'
  models: Model[]
  usedBy?: Array<{ id: string; emoji: string; name: string }>
}

/**
 * 模型统计数据
 */
export interface ModelStat {
  modelId: string
  provider: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  messageCount: number
  avgResponseMs: number
}

/**
 * 模型测试结果
 */
export interface ModelTestResult {
  ok: boolean
  elapsed: number
  model: string
  mode: string
  status: string
  error?: string
  text?: string
  source: string
  precision: string
}

// ===== Config Hot Reload 相关类型 =====

/**
 * 配置快照
 */
export interface ConfigSnapshot {
  valid?: boolean
  hash?: string
  raw?: string | null
  config?: Record<string, any>
}

/**
 * 热重载状态
 */
export interface HotReloadStatus {
  ok: boolean
  gatewayAvailable: boolean
  configValid?: boolean
  hash?: string
  hasConfig?: boolean
  error?: string
}

/**
 * 配置热重载结果
 */
export interface ConfigHotReloadResult {
  ok: boolean
  source?: 'gateway' | 'file'
  configValid?: boolean
  hash?: string
  config?: Record<string, any>
  raw?: string | null
  applied?: boolean
  reloaded?: boolean
  result?: any
  error?: string
}

// ===== Skill 相关类型 =====

/**
 * 技能文件
 */
export interface SkillFile {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: number
}

/**
 * 技能信息
 */
export interface SkillInfo {
  id: string
  name: string
  description: string
  emoji: string
  source: string
  location: string
  usedBy: string[]
  files?: SkillFile[]
}

/**
 * 技能 Agent 信息
 */
export interface SkillAgentInfo {
  name: string
  emoji: string
}

/**
 * 技能列表响应
 */
export interface SkillsListResponse {
  skills: SkillInfo[]
  agents: Record<string, SkillAgentInfo>
  total: number
  error?: string
}

/**
 * 技能内容响应
 */
export interface SkillContentResponse {
  skill: SkillInfo
  content: string
}

