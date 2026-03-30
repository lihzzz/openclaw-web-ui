import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ConfigData,
  AllStats,
  AgentTestResult,
  PlatformTestResult,
  SessionTestResult
} from '@/types'
import {
  fetchConfig,
  fetchAllStats,
  fetchAgentStatus,
  testAgents,
  testPlatforms,
  testSessions,
  testDmSessions,
  changeAgentModel
} from '@/services/agentApi'

export const useAgentStore = defineStore('agent', () => {
  // 配置数据
  const config = ref<ConfigData | null>(null)
  const stats = ref<AllStats | null>(null)
  const agentStatuses = ref<Record<string, string>>({})

  // 加载状态
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<string>('')

  // 刷新间隔（秒）
  const refreshInterval = ref(0)

  // 测试状态
  const testingAgents = ref(false)
  const testingPlatforms = ref(false)
  const testingSessions = ref(false)
  const testingDmSessions = ref(false)

  // 测试结果
  const agentTestResults = ref<Record<string, AgentTestResult | null>>({})
  const platformTestResults = ref<Record<string, PlatformTestResult | null>>({})
  const sessionTestResults = ref<Record<string, SessionTestResult | null>>({})
  const dmSessionResults = ref<Record<string, PlatformTestResult | null>>({})

  // 计算属性
  const agents = computed(() => config.value?.agents || [])
  const providers = computed(() => config.value?.providers || [])
  const defaults = computed(() => config.value?.defaults || { model: '', fallbacks: [] })
  const gateway = computed(() => config.value?.gateway || { port: 18789, host: '', hasToken: false })

  // 获取 Agent 状态
  function getAgentState(agentId: string): string {
    return agentStatuses.value[agentId] || 'offline'
  }

  // 刷新数据
  async function refresh(silent = false): Promise<void> {
    if (!silent) {
      loading.value = true
    }

    try {
      const [configData, statsData] = await Promise.all([
        fetchConfig(),
        fetchAllStats()
      ])

      if (configData.error) {
        error.value = configData.error
      } else {
        config.value = configData
        error.value = null
      }

      if (statsData) {
        stats.value = statsData
      }

      lastUpdated.value = new Date().toLocaleTimeString('zh-CN')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      if (!silent) {
        loading.value = false
      }
    }
  }

  // 刷新 Agent 状态
  async function refreshAgentStatus(): Promise<void> {
    try {
      const data = await fetchAgentStatus()
      const map: Record<string, string> = {}
      for (const status of data.statuses) {
        map[status.agentId] = status.state
      }
      agentStatuses.value = map
    } catch {
      // 静默失败
    }
  }

  // 测试所有 Agents
  async function runTestAgents(): Promise<void> {
    testingAgents.value = true

    // 设置所有 Agent 为待测试状态
    const pending: Record<string, null> = {}
    for (const agent of agents.value) {
      pending[agent.id] = null
    }
    agentTestResults.value = pending

    try {
      const data = await testAgents()
      const map: Record<string, AgentTestResult> = {}
      for (const result of data.results) {
        map[result.agentId] = result
      }
      agentTestResults.value = map
    } catch (e) {
      // 设置所有为失败
      const failed: Record<string, AgentTestResult> = {}
      for (const agent of agents.value) {
        failed[agent.id] = {
          agentId: agent.id,
          ok: false,
          error: e instanceof Error ? e.message : 'Request failed',
          elapsed: 0
        }
      }
      agentTestResults.value = failed
    } finally {
      testingAgents.value = false
    }
  }

  // 测试所有平台
  async function runTestPlatforms(): Promise<void> {
    testingPlatforms.value = true

    const pending: Record<string, null> = {}
    for (const agent of agents.value) {
      for (const platform of agent.platforms) {
        pending[`${agent.id}:${platform.name}`] = null
      }
    }
    platformTestResults.value = pending

    try {
      const data = await testPlatforms()
      const map: Record<string, PlatformTestResult> = {}
      for (const result of data.results) {
        map[`${result.agentId}:${result.platform}`] = result
      }
      platformTestResults.value = map
    } catch (e) {
      const failed: Record<string, PlatformTestResult> = {}
      for (const agent of agents.value) {
        for (const platform of agent.platforms) {
          failed[`${agent.id}:${platform.name}`] = {
            agentId: agent.id,
            platform: platform.name,
            ok: false,
            error: e instanceof Error ? e.message : 'Request failed',
            elapsed: 0
          }
        }
      }
      platformTestResults.value = failed
    } finally {
      testingPlatforms.value = false
    }
  }

  // 测试所有会话
  async function runTestSessions(): Promise<void> {
    testingSessions.value = true

    const pending: Record<string, null> = {}
    for (const agent of agents.value) {
      pending[agent.id] = null
    }
    sessionTestResults.value = pending

    try {
      const data = await testSessions()
      const map: Record<string, SessionTestResult> = {}
      for (const result of data.results) {
        map[result.agentId] = result
      }
      sessionTestResults.value = map
    } catch (e) {
      const failed: Record<string, SessionTestResult> = {}
      for (const agent of agents.value) {
        failed[agent.id] = {
          agentId: agent.id,
          ok: false,
          error: e instanceof Error ? e.message : 'Request failed',
          elapsed: 0
        }
      }
      sessionTestResults.value = failed
    } finally {
      testingSessions.value = false
    }
  }

  // 测试 DM 会话
  async function runTestDmSessions(): Promise<void> {
    testingDmSessions.value = true

    const pending: Record<string, null> = {}
    for (const agent of agents.value) {
      for (const platform of agent.platforms) {
        pending[`${agent.id}:${platform.name}`] = null
      }
    }
    dmSessionResults.value = pending

    try {
      const data = await testDmSessions()
      const map: Record<string, PlatformTestResult> = {}
      for (const result of data.results) {
        map[`${result.agentId}:${result.platform}`] = result
      }
      dmSessionResults.value = map
    } catch (e) {
      const failed: Record<string, PlatformTestResult> = {}
      for (const agent of agents.value) {
        for (const platform of agent.platforms) {
          failed[`${agent.id}:${platform.name}`] = {
            agentId: agent.id,
            platform: platform.name,
            ok: false,
            error: e instanceof Error ? e.message : 'Request failed',
            elapsed: 0
          }
        }
      }
      dmSessionResults.value = failed
    } finally {
      testingDmSessions.value = false
    }
  }

  // 切换模型
  async function setAgentModel(agentId: string, model: string): Promise<void> {
    await changeAgentModel(agentId, model)
    await refresh(true)
  }

  return {
    // 状态
    config,
    stats,
    agentStatuses,
    loading,
    error,
    lastUpdated,
    refreshInterval,
    testingAgents,
    testingPlatforms,
    testingSessions,
    testingDmSessions,
    agentTestResults,
    platformTestResults,
    sessionTestResults,
    dmSessionResults,

    // 计算属性
    agents,
    providers,
    defaults,
    gateway,

    // 方法
    getAgentState,
    refresh,
    refreshAgentStatus,
    runTestAgents,
    runTestPlatforms,
    runTestSessions,
    runTestDmSessions,
    setAgentModel
  }
})
