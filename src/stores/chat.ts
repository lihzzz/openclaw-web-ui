import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDeviceStore } from './deviceStore'
import type { Message, ToolCall, Settings, ConnectionState } from '@/types'
import { WEBSOCKET_CLOSE_REASONS } from '@/types'

export type { Message, ToolCall, Settings, ConnectionState }

/**
 * 聊天状态管理 Store
 */
export const useChatStore = defineStore('chat', () => {
  const deviceStore = useDeviceStore()
  
  // === 状态 ===
  
  // 连接状态
  const connectionState = ref<ConnectionState>('disconnected')
  const connectionError = ref<string>('')
  
  // WebSocket 实例
  const ws = ref<WebSocket | null>(null)
  
  // 消息列表
  const messages = ref<Message[]>([])
  
  // 打字状态
  const isTyping = ref<boolean>(false)
  const typingStartTime = ref<number>(0)
  
  // 当前运行 ID
  const currentRunId = ref<string>('')
  
  // 设置
  const settings = ref<Settings>({
    host: import.meta.env.VITE_GATEWAY_HOST || '127.0.0.1',
    port: parseInt(import.meta.env.VITE_GATEWAY_PORT) || 18789,
    token: import.meta.env.VITE_AUTH_TOKEN || '',
    dangerouslyDisableDeviceAuth: import.meta.env.VITE_DISABLE_DEVICE_AUTH === 'true',
    reconnectInterval: 3000,
    connectionTimeout: 10000
  })

  // 设置弹窗显示状态
  const showSettingsModal = ref<boolean>(false)

  // 实际被授予的权限（从服务器响应获取）
  const grantedScopes = ref<string[]>([])
  
  // 待处理的请求（用于响应匹配）
  const pendingRequests = ref<Map<string, { resolve: Function; reject: Function }>>(new Map())

  // 连接超时定时器
  let connectionTimeoutId: ReturnType<typeof setTimeout> | null = null

  // 重连定时器
  let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null

  // 是否应该重连
  const shouldReconnect = ref<boolean>(false)
  
  // === 计算属性 ===
  
  const isConnected = computed(() => connectionState.value === 'connected')
  
  const wsUrl = computed(() => {
    const { host, port } = settings.value
    return `ws://${host}:${port}`
  })
  
  const typingDuration = computed(() => {
    if (!isTyping.value || !typingStartTime.value) return 0
    return Math.floor((Date.now() - typingStartTime.value) / 1000)
  })
  
  // === 私有方法 ===
  
  /**
   * 生成请求 ID
   */
  function generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
  
  /**
   * 发送请求并等待响应
   */
  function sendRequest<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket 未连接'))
        return
      }
      
      const id = generateRequestId()
      const request = {
        type: 'req',
        id,
        method,
        params
      }
      
      pendingRequests.value.set(id, { resolve, reject })
      ws.value.send(JSON.stringify(request))
      
      // 超时处理
      setTimeout(() => {
        if (pendingRequests.value.has(id)) {
          pendingRequests.value.delete(id)
          reject(new Error('请求超时'))
        }
      }, 30000)
    })
  }
  
  /**
   * 处理 WebSocket 消息
   */
  function handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data)

      // 过滤心跳和健康检查消息
      if (data.type === 'event' && (data.event === 'health' || data.event === 'tick')) {
        return
      }

      switch (data.type) {
        case 'event':
          handleEvent(data)
          break
        case 'res':
          handleResponse(data)
          break
      }
    } catch {
      // 忽略解析错误
    }
  }
  
  /**
   * 处理事件消息
   */
  function handleEvent(data: { event: string; payload: unknown }): void {
    const { event, payload } = data

    // 过滤心跳消息
    if (event === 'health' || event === 'tick') {
      return
    }

    switch (event) {
      case 'connect.challenge':
        handleAuthChallenge(payload as { nonce: string; ts: number })
        break
      case 'connect.authenticated':
        connectionState.value = 'connected'
        connectionError.value = ''
        break
      case 'connect.ready':
        connectionState.value = 'connected'
        connectionError.value = ''
        break
      case 'agent':
        handleAgentEvent(payload as Record<string, unknown>)
        break
      case 'chat':
        handleChatEvent(payload as Record<string, unknown>)
        break
      case 'shutdown':
        handleShutdown(payload as { reason: string; message: string })
        break
    }
  }
  
  /**
   * 发送 connect 请求
   */
  async function sendConnectRequest(nonce?: string): Promise<void> {
    const token = settings.value.token

    if (!token) {
      connectionError.value = '缺少认证 Token'
      shouldReconnect.value = false  // 缺少 token 不应重连
      disconnect()
      return
    }

    connectionState.value = 'authenticating'

    // 根据认证模式选择 client.id：
    // - dangerouslyDisableDeviceAuth: true 时使用 'openclaw-control-ui' 以保留 scopes
    // - 否则使用 'webchat'
    const clientId = settings.value.dangerouslyDisableDeviceAuth
      ? 'openclaw-control-ui'
      : 'webchat'

    const params: Record<string, unknown> = {
      minProtocol: 1,
      maxProtocol: 10,
      client: {
        id: clientId,
        displayName: deviceStore.displayName,
        version: '1.0.0',
        platform: 'web',
        mode: 'webchat'
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.write', 'operator.read'],
      caps: ['tool-events'],
      auth: {
        token: token
      }
    }

    // 如果收到 challenge，需要携带 nonce
    if (nonce) {
      params.auth = {
        ...params.auth as Record<string, unknown>,
        nonce: nonce
      }
    }

    try {
      const result = await sendRequest<Record<string, unknown>>('connect', params)

      // 检查响应 - Gateway 成功响应可能包含 protocol 或 hello-ok 类型
      if (result && typeof result === 'object') {
        connectionState.value = 'connected'
        connectionError.value = ''

        // 保存被授予的权限信息
        if ('grantedScopes' in result && Array.isArray(result.grantedScopes)) {
          grantedScopes.value = result.grantedScopes as string[]
        }
        if ('auth' in result && result.auth && typeof result.auth === 'object') {
          const auth = result.auth as Record<string, unknown>
          if ('grantedScopes' in auth && Array.isArray(auth.grantedScopes)) {
            grantedScopes.value = auth.grantedScopes as string[]
          }
        }
      } else {
        connectionState.value = 'connected'
        connectionError.value = ''
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      connectionError.value = '认证失败: ' + errorMsg

      // 如果是 token 无效，不应重连
      if (errorMsg.includes('token') || errorMsg.includes('auth') || errorMsg.includes('unauthorized')) {
        shouldReconnect.value = false
      }

      connectionState.value = 'disconnected'
    }
  }
  
  /**
   * 处理认证挑战（用于正常认证流程）
   */
  function handleAuthChallenge(payload: { nonce: string; ts: number }): void {
    if (connectionState.value === 'authenticating' || connectionState.value === 'connected') {
      return
    }
    sendConnectRequest(payload.nonce)
  }
  
  /**
   * 处理 Agent 事件
   */
  function handleAgentEvent(payload: Record<string, unknown>): void {
    const stream = payload.stream as string
    const runId = payload.runId as string
    const sessionKey = payload.sessionKey as string
    const data = payload.data as Record<string, unknown> | undefined

    // sessionKey 过滤 - 只接受匹配当前 sessionKey 的消息
    if (sessionKey && deviceStore.sessionKey && sessionKey !== deviceStore.sessionKey) {
      return
    }

    switch (stream) {
      case 'lifecycle': {
        const state = (data?.state || data?.phase) as string

        if (state === 'start') {
          isTyping.value = true
          typingStartTime.value = Date.now()
          currentRunId.value = runId

          // 创建消息占位符（如果不存在）
          const existingIndex = messages.value.findIndex(m => m.runId === runId && m.role === 'assistant')
          if (existingIndex < 0) {
            messages.value.push({
              id: generateRequestId(),
              role: 'assistant',
              content: '...',  // 占位符，表示正在输入
              timestamp: Date.now(),
              runId
            })
          }
        } else if (state === 'done' || state === 'final') {
          isTyping.value = false
        } else if (state === 'error') {
          isTyping.value = false
        }
        break
      }

      case 'assistant': {
        // AI 回复文本 - 流式更新
        const text = extractTextFromPayload(data)
        if (text) {
          const filteredText = filterThoughts(text)
          // 查找并更新现有消息
          const existingIndex = messages.value.findIndex(m => m.runId === runId && m.role === 'assistant')
          if (existingIndex >= 0) {
            messages.value[existingIndex].content = filteredText
          }
        }
        break
      }

      case 'tool': {
        handleToolEvent(payload)
        break
      }
    }
  }

  /**
   * 从 payload.data 中提取文本
   */
  function extractTextFromPayload(data: Record<string, unknown> | undefined): string {
    if (!data) return ''

    // 格式1: data.text
    if (typeof data.text === 'string') return data.text

    // 格式2: data.content
    if (typeof data.content === 'string') return data.content

    // 格式3: data.delta.text
    if (data.delta && typeof data.delta === 'object') {
      const delta = data.delta as Record<string, unknown>
      if (typeof delta.text === 'string') return delta.text
    }

    return ''
  }

  /**
   * 过滤 thinking 标签
   */
  function filterThoughts(text: string): string {
    // 移除 <thought>...</thought> 标签
    let filtered = text.replace(/<thought>[\s\S]*?<\/thought>/g, '')
    // 移除 <antthinking>...</antthinking> 标签
    filtered = filtered.replace(/<antthinking>[\s\S]*?<\/antthinking>/g, '')
    return filtered.trim()
  }

  /**
   * 处理工具调用事件
   */
  function handleToolEvent(payload: Record<string, unknown>): void {
    const data = payload.data as Record<string, unknown> | undefined
    const runId = payload.runId as string
    if (!data) return

    const toolCallId = (data.toolCallId || data.id) as string || generateRequestId()
    const toolName = (data.name || data.toolName) as string
    const toolArgs = (data.args || data.toolInput || data.input) as Record<string, unknown>
    const toolResult = (data.result || data.toolOutput || data.output) as string
    let toolError = data.error as string | undefined
    const toolMeta = data.meta as string | undefined

    // Gateway 使用 phase 字段: "start" | "result" | "error"
    // 或者使用 status 字段: "running" | "completed" | "error"
    const phase = data.phase as string
    const status = data.status as string
    const isError = data.isError === true

    let finalStatus: 'pending' | 'running' | 'success' | 'error'

    if (phase) {
      // 使用 phase 字段判断状态
      if (phase === 'start') {
        finalStatus = 'running'
      } else if (phase === 'result') {
        // result 时需要检查 isError 标志
        finalStatus = isError ? 'error' : 'success'
      } else if (phase === 'error') {
        finalStatus = 'error'
      } else {
        finalStatus = 'running'
      }
    } else if (status) {
      // 使用 status 字段判断状态
      if (status === 'completed') {
        finalStatus = isError ? 'error' : 'success'
      } else {
        finalStatus = status as 'pending' | 'running' | 'success' | 'error'
      }
    } else {
      finalStatus = 'running'
    }

    // 当状态为 error 但没有 error 消息时，使用 meta 作为错误信息
    if (finalStatus === 'error' && !toolError && toolMeta) {
      toolError = toolMeta
    }

    // 查找当前 runId 对应的消息
    const messageIndex = messages.value.findIndex(m => m.runId === runId && m.role === 'assistant')

    if (messageIndex >= 0) {
      const message = messages.value[messageIndex]
      if (!message.toolCalls) {
        message.toolCalls = []
      }

      const existingIndex = message.toolCalls.findIndex(tc => tc.id === toolCallId)
      if (existingIndex >= 0) {
        message.toolCalls[existingIndex] = {
          ...message.toolCalls[existingIndex],
          status: finalStatus,
          output: toolResult,
          error: toolError
        }
      } else {
        message.toolCalls.push({
          id: toolCallId,
          name: toolName,
          input: toolArgs || {},
          output: toolResult,
          error: toolError,
          status: finalStatus
        })
      }
    } else {
      const lastAssistantMsg = [...messages.value].reverse().find(m => m.role === 'assistant')
      if (lastAssistantMsg) {
        if (!lastAssistantMsg.toolCalls) {
          lastAssistantMsg.toolCalls = []
        }
        const existingIndex = lastAssistantMsg.toolCalls.findIndex(tc => tc.id === toolCallId)
        if (existingIndex >= 0) {
          lastAssistantMsg.toolCalls[existingIndex] = {
            ...lastAssistantMsg.toolCalls[existingIndex],
            status: finalStatus,
            output: toolResult,
            error: toolError
          }
        } else {
          lastAssistantMsg.toolCalls.push({
            id: toolCallId,
            name: toolName,
            input: toolArgs || {},
            output: toolResult,
            error: toolError,
            status: finalStatus
          })
        }
      }
    }
  }

  /**
   * 处理聊天事件
   */
  function handleChatEvent(payload: Record<string, unknown>): void {
    const runId = payload.runId as string
    const state = payload.state as string // 'streaming' | 'final'
    const message = payload.message as Record<string, unknown> | undefined
    const sessionKey = payload.sessionKey as string

    // sessionKey 过滤 - 只接受匹配当前 sessionKey 的消息
    if (sessionKey && deviceStore.sessionKey && sessionKey !== deviceStore.sessionKey) {
      return
    }

    if (!message) return

    const role = message.role as 'user' | 'assistant' | 'system'
    const timestamp = (message.timestamp as number) || Date.now()

    // 提取 content - 支持多种格式
    let content = ''

    if (typeof message.content === 'string') {
      content = message.content
    } else if (Array.isArray(message.content)) {
      // 格式: [{ type: 'text', text: '...' }]
      content = message.content
        .filter((block: Record<string, unknown>) => block.type === 'text')
        .map((block: Record<string, unknown>) => block.text as string)
        .join('')
    }

    if (!content) return

    // 过滤 thinking 标签
    const filteredContent = filterThoughts(content)

    // 查找现有消息
    const existingIndex = messages.value.findIndex(m => m.runId === runId && m.role === role)

    if (state === 'final') {
      // 最终消息 - 更新或创建
      isTyping.value = false
      currentRunId.value = ''

      if (existingIndex >= 0) {
        messages.value[existingIndex].content = filteredContent
        saveMessages()
      } else {
        // 如果没有现有消息，创建新消息
        addMessage({
          id: generateRequestId(),
          role,
          content: filteredContent,
          timestamp,
          runId
        })
      }
    } else {
      // streaming 或其他状态 - 只更新现有消息，不创建新消息
      if (existingIndex >= 0) {
        messages.value[existingIndex].content = filteredContent
      }
    }
  }

  /**
   * 处理关闭事件
   */
  function handleShutdown(payload: { reason: string; message: string }): void {
    connectionError.value = `Gateway 关闭: ${payload.message || payload.reason}`
    disconnect()
  }
  
  /**
   * 处理响应消息
   */
  function handleResponse(data: { id: string; ok: boolean; payload?: unknown; error?: { message: string } }): void {
    const pending = pendingRequests.value.get(data.id)
    if (pending) {
      pendingRequests.value.delete(data.id)
      if (data.ok) {
        pending.resolve(data.payload)
      } else {
        pending.reject(new Error(data.error?.message || '请求失败'))
      }
    }
  }
  
  /**
   * 添加消息
   */
  function addMessage(message: Message): void {
    if (!message.content || !message.content.trim()) {
      return
    }
    messages.value.push(message)
    saveMessages()
  }

  /**
   * 保存消息到 localStorage
   */
  function saveMessages(): void {
    try {
      localStorage.setItem('gui-web-messages', JSON.stringify(messages.value.slice(-100)))
    } catch {
      // 忽略存储错误
    }
  }
  
  /**
   * 加载消息从 localStorage
   */
  function loadMessages(): void {
    try {
      const saved = localStorage.getItem('gui-web-messages')
      if (saved) {
        const loaded = JSON.parse(saved) as Message[]
        messages.value = loaded.filter(m => m.content && m.content.trim())
      }
    } catch {
      // 忽略加载错误
    }
  }
  
  // === 公共方法 ===
  
  /**
   * 清理连接超时定时器
   */
  function clearConnectionTimeout(): void {
    if (connectionTimeoutId) {
      clearTimeout(connectionTimeoutId)
      connectionTimeoutId = null
    }
  }

  /**
   * 清理重连定时器
   */
  function clearReconnectTimeout(): void {
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId)
      reconnectTimeoutId = null
    }
  }

  /**
   * 尝试重连
   */
  function attemptReconnect(): void {
    if (!shouldReconnect.value) return

    const interval = settings.value.reconnectInterval || 3000
    reconnectTimeoutId = setTimeout(() => {
      if (shouldReconnect.value) {
        connect()
      }
    }, interval)
  }

  /**
   * 清理所有待处理的请求
   */
  function clearPendingRequests(error: Error): void {
    pendingRequests.value.forEach(({ reject }) => {
      reject(error)
    })
    pendingRequests.value.clear()
  }

  /**
   * 连接 WebSocket
   */
  function connect(): void {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      return
    }

    clearConnectionTimeout()
    clearReconnectTimeout()

    connectionState.value = 'connecting'
    connectionError.value = ''
    shouldReconnect.value = true

    try {
      ws.value = new WebSocket(wsUrl.value)

      const timeout = settings.value.connectionTimeout || 10000
      connectionTimeoutId = setTimeout(() => {
        if (connectionState.value === 'connecting') {
          connectionError.value = `连接超时（${timeout / 1000}秒）`
          disconnect()
        }
      }, timeout)

      ws.value.onopen = () => {
        clearConnectionTimeout()

        if (settings.value.dangerouslyDisableDeviceAuth) {
          sendConnectRequest()
        }
      }

      ws.value.onmessage = (event) => {
        handleMessage(event)
      }

      ws.value.onerror = () => {
        connectionError.value = 'WebSocket 连接错误'
      }

      ws.value.onclose = (event) => {
        clearConnectionTimeout()

        clearPendingRequests(new Error('连接已关闭'))

        const wasConnected = connectionState.value === 'connected'
        connectionState.value = 'disconnected'
        ws.value = null

        if (event.code !== 1000 && event.code !== 1001) {
          connectionError.value = WEBSOCKET_CLOSE_REASONS[event.code] || `连接关闭: ${event.code} ${event.reason}`
        }

        if (shouldReconnect.value && (wasConnected || event.code === 1006)) {
          attemptReconnect()
        }
      }
    } catch (error) {
      connectionError.value = '创建连接失败: ' + (error as Error).message
      connectionState.value = 'disconnected'
    }
  }
  
  /**
   * 断开连接
   */
  function disconnect(): void {
    shouldReconnect.value = false
    clearConnectionTimeout()
    clearReconnectTimeout()

    if (ws.value) {
      ws.value.close()
      ws.value = null
    }

    clearPendingRequests(new Error('连接已断开'))

    connectionState.value = 'disconnected'
  }
  
  /**
   * 发送消息
   */
  async function sendMessage(content: string): Promise<void> {
    if (!content.trim()) return

    const trimmedContent = content.trim()

    // 添加用户消息
    addMessage({
      id: generateRequestId(),
      role: 'user',
      content: trimmedContent,
      timestamp: Date.now()
    })

    isTyping.value = true
    typingStartTime.value = Date.now()
    currentRunId.value = generateRequestId()

    try {
      await sendRequest('chat.send', {
        sessionKey: deviceStore.sessionKey,
        message: trimmedContent,
        idempotencyKey: `ik-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      })
    } catch (error) {
      isTyping.value = false
      throw error
    }
  }
  
  /**
   * 中止当前运行
   */
  async function abort(): Promise<void> {
    if (!currentRunId.value) return
    
    try {
      await sendRequest('chat.abort', {
        sessionKey: deviceStore.sessionKey,
        runId: currentRunId.value
      })
    } catch {
      // 忽略中止错误
    }
    
    isTyping.value = false
    currentRunId.value = ''
  }
  
  /**
   * 清空消息
   */
  function clearMessages(): void {
    messages.value = []
    localStorage.removeItem('gui-web-messages')
  }

  /**
   * 重置会话 - 发送 /new 命令并清空消息
   */
  async function resetSession(): Promise<void> {
    if (!ws.value || connectionState.value !== 'connected') {
      return
    }

    try {
      await sendRequest('chat.send', {
        sessionKey: deviceStore.sessionKey,
        message: '/new',
        idempotencyKey: `ik-${Date.now()}-reset`
      })
      clearMessages()
    } catch {
      clearMessages()
    }
  }
  
  /**
   * 更新设置
   */
  function updateSettings(newSettings: Partial<Settings>): void {
    settings.value = { ...settings.value, ...newSettings }
    localStorage.setItem('gui-web-settings', JSON.stringify(settings.value))
  }
  
  function init(): void {
    const savedSettings = localStorage.getItem('gui-web-settings')
    if (savedSettings) {
      try {
        settings.value = { ...settings.value, ...JSON.parse(savedSettings) }
      } catch {
        // 忽略加载错误
      }
    }

    loadMessages()
  }
  
  init()
  
  return {
    // 状态
    connectionState,
    connectionError,
    messages,
    isTyping,
    typingDuration,
    currentRunId,
    settings,
    grantedScopes,
    showSettingsModal,

    // 计算属性
    isConnected,
    wsUrl,

    // 方法
    connect,
    disconnect,
    sendMessage,
    abort,
    clearMessages,
    resetSession,
    updateSettings
  }
})