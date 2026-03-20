/**
 * Agent API 服务
 * 封装 Gateway API 调用
 * 开发环境通过 Vite 代理转发请求，避免 CORS 问题
 */

import type {
  ConfigData,
  AllStats,
  AgentStatus,
  AgentTestResult,
  PlatformTestResult,
  SessionTestResult,
  ModelStat,
  ModelTestResult,
  HotReloadStatus,
  ConfigHotReloadResult,
  SkillsListResponse,
  SkillContentResponse,
  SkillInfo,
  SkillFile
} from '@/types'

/**
 * 通用请求函数
 * 使用相对路径，由 Vite 代理转发到 Gateway
 */
async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 获取配置数据
 */
export async function fetchConfig(): Promise<ConfigData> {
  return request<ConfigData>('/api/config')
}

/**
 * 获取所有统计数据
 */
export async function fetchAllStats(): Promise<AllStats> {
  return request<AllStats>('/api/stats-all')
}

/**
 * 获取 Agent 状态
 */
export async function fetchAgentStatus(): Promise<{ statuses: AgentStatus[] }> {
  return request<{ statuses: AgentStatus[] }>('/api/agent-status')
}

/**
 * 测试所有 Agents
 */
export async function testAgents(): Promise<{ results: AgentTestResult[] }> {
  return request<{ results: AgentTestResult[] }>('/api/test-agents', {
    method: 'POST'
  })
}

/**
 * 测试所有平台
 */
export async function testPlatforms(): Promise<{ results: PlatformTestResult[] }> {
  return request<{ results: PlatformTestResult[] }>('/api/test-platforms', {
    method: 'POST'
  })
}

/**
 * 测试所有会话
 */
export async function testSessions(): Promise<{ results: SessionTestResult[] }> {
  return request<{ results: SessionTestResult[] }>('/api/test-sessions', {
    method: 'POST'
  })
}

/**
 * 测试 DM 会话
 */
export async function testDmSessions(): Promise<{ results: PlatformTestResult[] }> {
  return request<{ results: PlatformTestResult[] }>('/api/test-dm-sessions', {
    method: 'POST'
  })
}

/**
 * 切换 Agent 模型
 */
export async function changeAgentModel(
  agentId: string,
  model: string
): Promise<{ success: boolean; error?: string }> {
  return request<{ success: boolean; error?: string }>(
    '/api/config/agent-model',
    {
      method: 'PATCH',
      body: JSON.stringify({ agentId, model })
    }
  )
}

/**
 * 获取 Gateway 健康状态
 */
export async function fetchGatewayHealth(): Promise<{
  ok: boolean
  openclawVersion?: string
}> {
  return request<{ ok: boolean; openclawVersion?: string }>('/api/gateway-health')
}

/**
 * 获取模型统计数据
 */
export async function fetchModelStats(): Promise<{ models: ModelStat[] }> {
  return request<{ models: ModelStat[] }>('/api/stats-models')
}

/**
 * 测试模型
 */
export async function testModel(
  providerId: string,
  modelId: string
): Promise<ModelTestResult> {
  return request<ModelTestResult>('/api/test-model', {
    method: 'POST',
    body: JSON.stringify({ provider: providerId, modelId })
  })
}

/**
 * 获取热重载状态
 */
export async function fetchHotReloadStatus(): Promise<HotReloadStatus> {
  return request<HotReloadStatus>('/api/config-hot-reload/status')
}

/**
 * 获取配置（支持热重载）
 */
export async function fetchConfigForHotReload(): Promise<ConfigHotReloadResult> {
  return request<ConfigHotReloadResult>('/api/config-hot-reload')
}

/**
 * 应用配置补丁（热重载）
 */
export async function applyConfigPatch(
  patch: Record<string, any>,
  baseHash?: string,
  note?: string
): Promise<ConfigHotReloadResult> {
  return request<ConfigHotReloadResult>('/api/config-hot-reload', {
    method: 'POST',
    body: JSON.stringify({ patch, baseHash, note })
  })
}

/**
 * 强制重新加载配置
 */
export async function reloadConfig(): Promise<ConfigHotReloadResult> {
  return request<ConfigHotReloadResult>('/api/config-hot-reload/reload', {
    method: 'POST'
  })
}

// ===== Skills API =====

/**
 * 获取所有技能
 */
export async function fetchSkills(): Promise<SkillsListResponse> {
  return request<SkillsListResponse>('/api/skills')
}

/**
 * 获取技能内容
 */
export async function fetchSkillContent(
  source: string,
  id: string
): Promise<SkillContentResponse> {
  return request<SkillContentResponse>(
    `/api/skills/content?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`
  )
}

/**
 * 获取技能文件列表
 */
export async function fetchSkillFiles(
  skillDir: string
): Promise<{ files: SkillFile[] }> {
  return request<{ files: SkillFile[] }>(
    `/api/skill-files?skillDir=${encodeURIComponent(skillDir)}`
  )
}

/**
 * 读取技能文件
 */
export async function readSkillFile(
  filePath: string
): Promise<{ content: string; exists: boolean }> {
  return request<{ content: string; exists: boolean }>(
    `/api/skill-files/read?filePath=${encodeURIComponent(filePath)}`
  )
}

/**
 * 写入技能文件
 */
export async function writeSkillFile(
  filePath: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  return request<{ success: boolean; error?: string }>('/api/skill-files/write', {
    method: 'POST',
    body: JSON.stringify({ filePath, content })
  })
}

/**
 * 创建新技能
 */
export async function createSkill(
  skillId: string,
  name: string,
  description: string,
  emoji: string
): Promise<{ success: boolean; skill?: SkillInfo; error?: string }> {
  return request<{ success: boolean; skill?: SkillInfo; error?: string }>(
    '/api/skill-files/create-skill',
    {
      method: 'POST',
      body: JSON.stringify({ skillId, name, description, emoji })
    }
  )
}

/**
 * 删除技能
 */
export async function deleteSkill(
  source: string,
  skillId: string
): Promise<{ success: boolean; error?: string }> {
  return request<{ success: boolean; error?: string }>(
    '/api/skill-files/delete-skill',
    {
      method: 'DELETE',
      body: JSON.stringify({ source, skillId })
    }
  )
}

/**
 * 创建技能文件
 */
export async function createSkillFile(
  skillDir: string,
  fileName: string,
  content?: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  return request<{ success: boolean; path?: string; error?: string }>(
    '/api/skill-files/create-file',
    {
      method: 'POST',
      body: JSON.stringify({ skillDir, fileName, content })
    }
  )
}

/**
 * 删除技能文件
 */
export async function deleteSkillFile(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  return request<{ success: boolean; error?: string }>(
    '/api/skill-files/delete-file',
    {
      method: 'DELETE',
      body: JSON.stringify({ filePath })
    }
  )
}

/**
 * 重新加载技能
 */
export async function reloadSkills(): Promise<{ success: boolean; error?: string }> {
  return request<{ success: boolean; error?: string }>('/api/skill-files/reload', {
    method: 'POST'
  })
}