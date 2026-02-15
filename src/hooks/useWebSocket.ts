import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  NewSessionRequest,
  PromptRequest,
  ResumeSessionRequest,
  SessionNotification,
  ContentBlock,
  CancelNotification,
  SetSessionModeRequest,
  SetSessionModelRequest
} from '@agentclientprotocol/sdk'
import type {
  ConnectionStatus,
  RawMessage,
  ChatMessage,
  AgentState,
  ToolCall,
  PermissionOption,
  ModeOption,
  ModelOption,
  ChatRoundMetrics,
  RoundUsage,
} from '../types'

const WS_URL = 'ws://127.0.0.1:3000/ws'
const DEFAULT_CWD = '/Users/arthur/RustroverProjects/my-demo'
const LAST_SESSION_ID_STORAGE_KEY = 'acp_web:last_session_id'
const RECENT_SESSION_IDS_STORAGE_KEY = 'acp_web:recent_session_ids'
const AUTO_NEW_SESSION_STORAGE_KEY = 'acp_web:auto_new_session_enabled'
const MAX_RECENT_SESSION_IDS = 5

const FALLBACK_MODES: ModeOption[] = [
  { id: 'default', name: 'Default' },
  { id: 'accept_edits', name: 'Accept Edits' },
  { id: 'plan_mode', name: 'Plan Mode' },
  { id: 'dont_ask', name: "Don't Ask" },
  { id: 'bypass_permissions', name: 'Bypass Permissions' },
]

const FALLBACK_MODELS: ModelOption[] = [
  { id: 'default', name: 'Default (recommended)' },
  { id: 'opus', name: 'Opus' },
  { id: 'opus_1m', name: 'Opus (1M context)' },
  { id: 'haiku', name: 'Haiku' },
]

let requestId = 1

function readStoredAutoNewSessionEnabled(): boolean {
  if (typeof window === 'undefined') return true

  try {
    const value = window.localStorage.getItem(AUTO_NEW_SESSION_STORAGE_KEY)
    if (value === null) return true
    return value === '1'
  } catch {
    return true
  }
}

function persistAutoNewSessionEnabled(value: boolean) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(AUTO_NEW_SESSION_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Ignore storage failures.
  }
}

function readStoredSessionIds(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const rawValue = window.localStorage.getItem(RECENT_SESSION_IDS_STORAGE_KEY)
    if (!rawValue) return []

    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) return []

    const uniqueIds = Array.from(new Set(
      parsed
        .filter((value): value is string => typeof value === 'string')
        .map(value => value.trim())
        .filter(Boolean),
    ))

    return uniqueIds.slice(0, MAX_RECENT_SESSION_IDS)
  } catch {
    return []
  }
}

function persistSessionId(value: string): string[] {
  const sessionValue = value.trim()
  if (!sessionValue) return readStoredSessionIds()

  const existingSessionIds = readStoredSessionIds()
  const nextSessionIds = [
    sessionValue,
    ...existingSessionIds.filter(sessionId => sessionId !== sessionValue),
  ].slice(0, MAX_RECENT_SESSION_IDS)

  if (typeof window === 'undefined') return nextSessionIds

  try {
    window.localStorage.setItem(LAST_SESSION_ID_STORAGE_KEY, sessionValue)
    window.localStorage.setItem(RECENT_SESSION_IDS_STORAGE_KEY, JSON.stringify(nextSessionIds))
  } catch {
    // Ignore storage failures.
  }

  return nextSessionIds
}

/** Map ACP SDK status to our display status */
function mapToolCallStatus(status: string): ToolCall['status'] {
  switch (status) {
    case 'completed':
    case 'done':
    case 'success':
      return 'completed'
    case 'failed':
    case 'error':
    case 'cancelled':
      return 'error'
    default:
      return 'running' // pending, in_progress, running, etc.
  }
}

/** Extract text from tool-call content payloads */
function extractContentText(content: unknown): string | undefined {
  if (!content) return undefined

  // Backward-compatible payloads may send plain text or { text: string }.
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) {
    if (typeof content !== 'object') return undefined
    const contentObj = content as { text?: unknown; content?: { text?: unknown } }
    if (typeof contentObj.text === 'string') return contentObj.text
    if (typeof contentObj.content?.text === 'string') return contentObj.content.text
    return undefined
  }

  const texts = content
    .map(item => {
      if (!item || typeof item !== 'object') return undefined
      const toolContent = item as {
        type?: string
        content?: { type?: string; text?: string }
        path?: string
        terminalId?: string
      }

      if (toolContent.type === 'content' && typeof toolContent.content?.text === 'string') {
        return toolContent.content.text
      }
      if (toolContent.type === 'diff' && typeof toolContent.path === 'string') {
        return `Updated ${toolContent.path}`
      }
      if (toolContent.type === 'terminal' && typeof toolContent.terminalId === 'string') {
        return `Terminal ${toolContent.terminalId}`
      }
      return undefined
    })
    .filter((text): text is string => typeof text === 'string' && text.length > 0)

  return texts.length > 0 ? texts.join('\n') : undefined
}

function createJsonRpcRequest(method: string, params: unknown) {
  return {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params,
  }
}

function readModeState(value: unknown): { options: ModeOption[]; currentModeId: string } | null {
  if (!value || typeof value !== 'object') return null

  const state = value as {
    currentModeId?: unknown
    availableModes?: unknown
  }

  if (typeof state.currentModeId !== 'string') return null

  const options: ModeOption[] = []
  if (Array.isArray(state.availableModes)) {
    for (const item of state.availableModes) {
      if (!item || typeof item !== 'object') continue
      const mode = item as { id?: unknown; name?: unknown; description?: unknown }
      if (typeof mode.id !== 'string' || typeof mode.name !== 'string') continue

      const option: ModeOption = {
        id: mode.id,
        name: mode.name,
      }

      if (typeof mode.description === 'string') {
        option.description = mode.description
      }

      options.push(option)
    }
  }

  if (options.length === 0) return null

  return { options, currentModeId: state.currentModeId }
}

function readModelState(value: unknown): { options: ModelOption[]; currentModelId: string } | null {
  if (!value || typeof value !== 'object') return null

  const state = value as {
    currentModelId?: unknown
    availableModels?: unknown
  }

  if (typeof state.currentModelId !== 'string') return null

  const options: ModelOption[] = []
  if (Array.isArray(state.availableModels)) {
    for (const item of state.availableModels) {
      if (!item || typeof item !== 'object') continue
      const model = item as { modelId?: unknown; name?: unknown; description?: unknown }
      if (typeof model.modelId !== 'string' || typeof model.name !== 'string') continue

      const option: ModelOption = {
        id: model.modelId,
        name: model.name,
      }

      if (typeof model.description === 'string') {
        option.description = model.description
      }

      options.push(option)
    }
  }

  if (options.length === 0) return null

  return { options, currentModelId: state.currentModelId }
}

type StreamingRole = 'assistant' | 'thought' | null

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function readUsage(value: unknown): RoundUsage | undefined {
  if (!value || typeof value !== 'object') return undefined

  const usage = value as Record<string, unknown>
  const inputTokens = parseNumber(usage.inputTokens ?? usage.input_tokens)
  const outputTokens = parseNumber(usage.outputTokens ?? usage.output_tokens)
  const cacheReadTokens = parseNumber(
    usage.cacheReadInputTokens
      ?? usage.cache_read_input_tokens
      ?? usage.cacheReadTokens
      ?? usage.cache_read_tokens,
  )
  const cacheWriteTokens = parseNumber(
    usage.cacheCreationInputTokens
      ?? usage.cache_creation_input_tokens
      ?? usage.cacheWriteTokens
      ?? usage.cache_write_tokens,
  )
  const costUsd = parseNumber(
    usage.costUsd
      ?? usage.costUSD
      ?? usage.cost
      ?? usage.totalCostUsd
      ?? usage.total_cost_usd,
  )

  if (
    inputTokens === undefined
    && outputTokens === undefined
    && cacheReadTokens === undefined
    && cacheWriteTokens === undefined
    && costUsd === undefined
  ) {
    return undefined
  }

  return {
    ...(inputTokens !== undefined && { inputTokens }),
    ...(outputTokens !== undefined && { outputTokens }),
    ...(cacheReadTokens !== undefined && { cacheReadTokens }),
    ...(cacheWriteTokens !== undefined && { cacheWriteTokens }),
    ...(costUsd !== undefined && { costUsd }),
  }
}

function readModelLabel(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined

  const model = value as Record<string, unknown>
  const modelName = typeof model.name === 'string' ? model.name : undefined
  const provider = typeof model.providerName === 'string'
    ? model.providerName
    : typeof model.provider === 'string'
      ? model.provider
      : undefined

  if (modelName && provider) return `${modelName} via ${provider}`
  return modelName ?? provider
}

function mapStopReasonToStatus(stopReason: unknown): ChatRoundMetrics['status'] {
  if (typeof stopReason !== 'string') return 'completed'
  const value = stopReason.toLowerCase()
  if (value.includes('cancel') || value.includes('interrupt')) return 'cancelled'
  if (value.includes('error') || value.includes('fail')) return 'error'
  return 'completed'
}

export function useWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [rawMessages, setRawMessages] = useState<RawMessage[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [agentState, setAgentState] = useState<AgentState>('idle')
  const [initialized, setInitialized] = useState(false)
  const [modeOptions, setModeOptions] = useState<ModeOption[]>(FALLBACK_MODES)
  const [selectedModeId, setSelectedModeId] = useState<string>(FALLBACK_MODES[0].id)
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(FALLBACK_MODELS)
  const [selectedModelId, setSelectedModelId] = useState<string>(FALLBACK_MODELS.find(option => option.id === 'opus')?.id ?? FALLBACK_MODELS[0].id)
  const [autoNewSessionEnabled, setAutoNewSessionEnabled] = useState<boolean>(() => readStoredAutoNewSessionEnabled())
  const [recentSessionIds, setRecentSessionIds] = useState<string[]>(() => readStoredSessionIds())
  const [roundMetricsByPromptId, setRoundMetricsByPromptId] = useState<Record<string, ChatRoundMetrics>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const initRequestIdRef = useRef<number | null>(null)
  const resumeRequestMapRef = useRef<Map<number, { sessionId: string; auto: boolean }>>(new Map())
  const autoSessionCreatedRef = useRef(false)
  const streamingRoleRef = useRef<StreamingRole>(null)
  const streamingMessageIdRef = useRef<string | null>(null)
  const toolCallGroupIdRef = useRef<string | null>(null)
  const activePromptIdRef = useRef<string | null>(null)
  const activePromptRequestIdRef = useRef<number | null>(null)

  const addRawMessage = useCallback((direction: 'sent' | 'received', data: unknown) => {
    setRawMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      direction,
      data,
    }])
  }, [])

  const addChatMessage = useCallback((role: ChatMessage['role'], content: string) => {
    const id = crypto.randomUUID()
    setChatMessages(prev => [...prev, {
      id,
      role,
      content,
      timestamp: new Date(),
    }])
    return id
  }, [])

  const appendToStreamingMessage = useCallback((role: 'assistant' | 'thought', text: string) => {
    // Reset tool call group when text streaming starts
    toolCallGroupIdRef.current = null

    if (role === 'assistant') {
      setAgentState('responding')
    } else if (role === 'thought') {
      setAgentState('thinking')
    }

    if (streamingRoleRef.current !== role || !streamingMessageIdRef.current) {
      streamingRoleRef.current = role
      const id = crypto.randomUUID()
      streamingMessageIdRef.current = id
      setChatMessages(prev => [...prev, {
        id,
        role,
        content: text,
        timestamp: new Date(),
      }])
    } else {
      setChatMessages(prev => prev.map(msg =>
        msg.id === streamingMessageIdRef.current
          ? { ...msg, content: msg.content + text }
          : msg
      ))
    }
  }, [])

  const endStreaming = useCallback(() => {
    streamingRoleRef.current = null
    streamingMessageIdRef.current = null
    toolCallGroupIdRef.current = null
    setAgentState('idle')
  }, [])

  const completeActiveRound = useCallback((status: ChatRoundMetrics['status'], result?: unknown) => {
    const activePromptId = activePromptIdRef.current
    if (!activePromptId) return

    setRoundMetricsByPromptId(prev => {
      const existing = prev[activePromptId]
      if (!existing) return prev

      const resultObj = result && typeof result === 'object' ? result as Record<string, unknown> : undefined
      const usage = readUsage(resultObj?.usage)
      const modelLabel = readModelLabel(resultObj?.model)

      return {
        ...prev,
        [activePromptId]: {
          ...existing,
          status,
          endedAt: Date.now(),
          ...(usage && { usage: { ...(existing.usage ?? {}), ...usage } }),
          ...(modelLabel && { modelLabel }),
        },
      }
    })

    activePromptIdRef.current = null
    activePromptRequestIdRef.current = null
  }, [])

  const handleServerRequest = useCallback((id: number, method: string, params: Record<string, unknown>) => {
    if (method === 'session/request_permission') {
      setAgentState('awaiting_permission')
      // End text streaming
      streamingRoleRef.current = null
      streamingMessageIdRef.current = null

      const options = (params.options as PermissionOption[]) || []
      const toolCall = params.toolCall as { toolCallId?: string; title?: string; rawInput?: Record<string, unknown> } | undefined

      const msgId = crypto.randomUUID()
      setChatMessages(prev => [...prev, {
        id: msgId,
        role: 'permission_request' as const,
        content: toolCall?.title || 'Permission required',
        timestamp: new Date(),
        permissionRequest: {
          jsonRpcId: id,
          options,
          toolCall: {
            toolCallId: toolCall?.toolCallId || '',
            title: toolCall?.title || 'Unknown tool',
            rawInput: toolCall?.rawInput,
          },
          resolved: false,
        },
      }])
    }
  }, [])

  const respondToPermission = useCallback((messageId: string, optionId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    // Find the permission request message to get the JSON-RPC id
    let jsonRpcId: number | null = null
    setChatMessages(prev => {
      const msg = prev.find(m => m.id === messageId && m.permissionRequest)
      if (msg?.permissionRequest) {
        jsonRpcId = msg.permissionRequest.jsonRpcId
      }
      return prev.map(m =>
        m.id === messageId && m.permissionRequest
          ? { ...m, permissionRequest: { ...m.permissionRequest, resolved: true, selectedOptionId: optionId } }
          : m
      )
    })

    if (jsonRpcId === null) return

    const response = {
      jsonrpc: '2.0',
      id: jsonRpcId,
      result: {
        outcome: {
          outcome: 'selected',
          optionId,
        },
      },
    }

    addRawMessage('sent', response)
    wsRef.current.send(JSON.stringify(response))
    setAgentState('tool_calling')
  }, [addRawMessage])

  const respondToAskUserQuestion = useCallback((messageId: string, answers: Record<string, string>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    let jsonRpcId: number | null = null
    let rawInput: Record<string, unknown> | undefined
    setChatMessages(prev => {
      const msg = prev.find(m => m.id === messageId && m.permissionRequest)
      if (msg?.permissionRequest) {
        jsonRpcId = msg.permissionRequest.jsonRpcId
        rawInput = msg.permissionRequest.toolCall.rawInput
      }
      return prev.map(m =>
        m.id === messageId && m.permissionRequest
          ? { ...m, permissionRequest: { ...m.permissionRequest, resolved: true, selectedOptionId: 'allow', answers } }
          : m
      )
    })

    if (jsonRpcId === null) return

    const response = {
      jsonrpc: '2.0',
      id: jsonRpcId,
      result: {
        outcome: {
          outcome: 'selected',
          optionId: 'allow',
        },
        updatedInput: {
          questions: rawInput?.questions ?? [],
          answers,
        },
      },
    }

    addRawMessage('sent', response)
    wsRef.current.send(JSON.stringify(response))
    setAgentState('tool_calling')
  }, [addRawMessage])

  const cancelPendingPermissionRequests = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const responses: Array<{
      jsonrpc: '2.0'
      id: number
      result: {
        outcome: {
          outcome: 'cancelled'
        }
      }
    }> = []

    setChatMessages(prev => prev.map(msg => {
      if (msg.role !== 'permission_request' || !msg.permissionRequest || msg.permissionRequest.resolved) {
        return msg
      }

      responses.push({
        jsonrpc: '2.0',
        id: msg.permissionRequest.jsonRpcId,
        result: {
          outcome: {
            outcome: 'cancelled',
          },
        },
      })

      return {
        ...msg,
        permissionRequest: {
          ...msg.permissionRequest,
          resolved: true,
          selectedOptionId: 'cancelled',
        },
      }
    }))

    for (const response of responses) {
      addRawMessage('sent', response)
      wsRef.current.send(JSON.stringify(response))
    }
  }, [addRawMessage])

  const sendInitialize = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const request = createJsonRpcRequest('initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: {
          readTextFile: false,
          writeTextFile: false,
        },
        terminal: false,
      },
      clientInfo: {
        name: 'hi-agent-web',
        title: 'Hi Agent Web',
        version: '1.0.0',
      },
    })

    initRequestIdRef.current = request.id
    addRawMessage('sent', request)
    wsRef.current.send(JSON.stringify(request))
  }, [addRawMessage])

  const handleNotification = useCallback((method: string, params: SessionNotification) => {
    if (method === 'session/update' && params) {
      const update = params.update as Record<string, unknown>
      const sessionUpdate = update.sessionUpdate as string | undefined

      if (sessionUpdate === 'current_mode_update') {
        const currentModeId = update.currentModeId
        if (typeof currentModeId === 'string') {
          setSelectedModeId(currentModeId)
        }
      }

      const upsertToolCall = (toolUpdate: Record<string, unknown>) => {
        setAgentState('tool_calling')
        // End text streaming but preserve tool call groups.
        streamingRoleRef.current = null
        streamingMessageIdRef.current = null

        const fallbackId = toolUpdate.id
        const legacyToolCallId = toolUpdate.tool_call_id
        const rawToolCallId = toolUpdate.toolCallId ?? legacyToolCallId ?? fallbackId
        const toolCallId = typeof rawToolCallId === 'string' && rawToolCallId.length > 0
          ? rawToolCallId
          : crypto.randomUUID()

        const rawStatus = toolUpdate.status
        const status = typeof rawStatus === 'string' ? mapToolCallStatus(rawStatus) : undefined
        const title = typeof toolUpdate.title === 'string' ? toolUpdate.title : undefined
        const kind = typeof toolUpdate.kind === 'string' ? toolUpdate.kind : undefined
        const contentText = extractContentText(toolUpdate.content)
        const locations = toolUpdate.locations
        const rawInput = toolUpdate.rawInput as Record<string, unknown> | undefined
        const promptText = typeof rawInput?.prompt === 'string' ? rawInput.prompt : undefined

        // Extract parentToolCallId and toolName from _meta.claudeCode
        const meta = toolUpdate._meta as Record<string, unknown> | undefined
        const claudeCode = meta?.claudeCode as Record<string, unknown> | undefined
        const parentToolCallId = typeof claudeCode?.parentToolCallId === 'string' ? claudeCode.parentToolCallId : undefined
        const toolName = typeof claudeCode?.toolName === 'string' ? claudeCode.toolName : undefined

        // Skip AskUserQuestion – it is displayed via the permission request flow
        if (toolName === 'AskUserQuestion') return

        // Helper: recursively find and update a tool call by id within nested children
        const updateToolCallInList = (list: ToolCall[], id: string, updater: (tc: ToolCall) => ToolCall): ToolCall[] => {
          return list.map(tc => {
            if (tc.toolCallId === id) return updater(tc)
            if (tc.children?.length) {
              const updatedChildren = updateToolCallInList(tc.children, id, updater)
              if (updatedChildren !== tc.children) return { ...tc, children: updatedChildren }
            }
            return tc
          })
        }

        // Helper: recursively check if a tool call exists in nested children
        const findToolCallInList = (list: ToolCall[], id: string): boolean => {
          for (const tc of list) {
            if (tc.toolCallId === id) return true
            if (tc.children?.length && findToolCallInList(tc.children, id)) return true
          }
          return false
        }

        // Helper: add a child tool call under a parent in nested structure
        const addChildToParent = (list: ToolCall[], parentId: string, child: ToolCall): ToolCall[] => {
          return list.map(tc => {
            if (tc.toolCallId === parentId) {
              return { ...tc, children: [...(tc.children || []), child] }
            }
            if (tc.children?.length) {
              const updatedChildren = addChildToParent(tc.children, parentId, child)
              if (updatedChildren !== tc.children) return { ...tc, children: updatedChildren }
            }
            return tc
          })
        }

        setChatMessages(prev => {
          // First, check if this tool call already exists (update case)
          const existingGroup = prev.find(
            msg => msg.role === 'tool_call_group' && msg.toolCalls && findToolCallInList(msg.toolCalls, toolCallId)
          )

          if (existingGroup) {
            toolCallGroupIdRef.current = existingGroup.id
            return prev.map(msg => {
              if (msg.id !== existingGroup.id || msg.role !== 'tool_call_group') return msg
              return {
                ...msg,
                toolCalls: updateToolCallInList(msg.toolCalls!, toolCallId, tc => ({
                  ...tc,
                  ...(status && { status }),
                  ...(title && { title }),
                  ...(kind && { kind }),
                  ...(toolName && { toolName }),
                  ...(promptText && { promptText }),
                  ...(contentText && { content: contentText }),
                  ...(locations !== undefined && { locations }),
                })),
              }
            })
          }

          const newToolCall: ToolCall = {
            toolCallId,
            title: title || 'Tool Call',
            status: status || 'running',
            ...(kind && { kind }),
            ...(contentText && { content: contentText }),
            ...(promptText && { promptText }),
            ...(locations !== undefined && { locations }),
            ...(toolName && { toolName }),
            ...(parentToolCallId && { parentToolCallId }),
          }

          // If this tool call has a parent, nest it under the parent
          if (parentToolCallId) {
            const parentGroup = prev.find(
              msg => msg.role === 'tool_call_group' && msg.toolCalls && findToolCallInList(msg.toolCalls, parentToolCallId)
            )
            if (parentGroup) {
              toolCallGroupIdRef.current = parentGroup.id
              return prev.map(msg =>
                msg.id === parentGroup.id && msg.role === 'tool_call_group'
                  ? { ...msg, toolCalls: addChildToParent(msg.toolCalls!, parentToolCallId, newToolCall) }
                  : msg
              )
            }
          }

          // No parent or parent not found – add as top-level tool call
          if (toolCallGroupIdRef.current) {
            const currentGroupId = toolCallGroupIdRef.current
            const groupExists = prev.some(
              msg => msg.id === currentGroupId && msg.role === 'tool_call_group'
            )
            if (groupExists) {
              return prev.map(msg =>
                msg.id === currentGroupId && msg.role === 'tool_call_group'
                  ? { ...msg, toolCalls: [...(msg.toolCalls || []), newToolCall] }
                  : msg
              )
            }
          }

          const groupId = crypto.randomUUID()
          toolCallGroupIdRef.current = groupId
          return [...prev, {
            id: groupId,
            role: 'tool_call_group' as const,
            content: '',
            timestamp: new Date(),
            toolCalls: [newToolCall],
          }]
        })
      }

      if (sessionUpdate === 'agent_message_chunk') {
        const content = update.content as ContentBlock
        if (content.type === 'text') {
          appendToStreamingMessage('assistant', content.text)
        }
      }

      if (sessionUpdate === 'agent_thought_chunk') {
        const content = update.content as ContentBlock
        if (content.type === 'text') {
          appendToStreamingMessage('thought', content.text)
        }
      }

      if (sessionUpdate === 'tool_call' || sessionUpdate === 'tool_call_update' || sessionUpdate === 'tool_update') {
        upsertToolCall(update)
      }
    }
  }, [appendToStreamingMessage])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      addChatMessage('system', 'Connected')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        addRawMessage('received', data)

        if (data.method && data.id !== undefined) {
          // Server-to-client JSON-RPC request (needs a response)
          handleServerRequest(data.id, data.method, data.params)
        } else if (data.result) {
          const resumeMeta = typeof data.id === 'number'
            ? resumeRequestMapRef.current.get(data.id)
            : undefined

          const modeState = readModeState(data.result.modes)
          if (modeState) {
            setModeOptions(modeState.options)
            setSelectedModeId(modeState.currentModeId)
          }

          const modelState = readModelState(data.result.models)
          if (modelState) {
            setModelOptions(modelState.options)
            setSelectedModelId(modelState.currentModelId)
          }

          if (resumeMeta) {
            resumeRequestMapRef.current.delete(data.id)
            setSessionId(resumeMeta.sessionId)
            setRecentSessionIds(persistSessionId(resumeMeta.sessionId))
            addChatMessage('system', `Session resumed (${resumeMeta.sessionId})`)
            return
          }

          // Handle initialize response
          if (data.id === initRequestIdRef.current) {
            initRequestIdRef.current = null
            setInitialized(true)
            addChatMessage('system', `Initialized (agent: ${data.result.agentInfo?.name || 'unknown'})`)
          } else if (data.result.sessionId) {
            setSessionId(data.result.sessionId)
            setRecentSessionIds(persistSessionId(data.result.sessionId))
            addChatMessage('system', 'Session ready')
          }
          if (data.result.stopReason) {
            endStreaming()
            completeActiveRound(mapStopReasonToStatus(data.result.stopReason), data.result)
          }
        } else if (data.error) {
          const resumeMeta = typeof data.id === 'number'
            ? resumeRequestMapRef.current.get(data.id)
            : undefined

          if (resumeMeta) {
            resumeRequestMapRef.current.delete(data.id)
            addChatMessage('system', `Resume failed: ${data.error.message}`)

            if (resumeMeta.auto && wsRef.current?.readyState === WebSocket.OPEN) {
              const fallbackRequest = createJsonRpcRequest('session/new', {
                cwd: DEFAULT_CWD,
                mcpServers: [],
              } satisfies NewSessionRequest)
              addRawMessage('sent', fallbackRequest)
              wsRef.current.send(JSON.stringify(fallbackRequest))
            }
            return
          }

          addChatMessage('system', `Error: ${data.error.message}`)
          const isActivePromptError = typeof data.id === 'number' && data.id === activePromptRequestIdRef.current
          if (isActivePromptError) {
            endStreaming()
            completeActiveRound('error', { error: data.error })
            return
          }
          endStreaming()
        } else if (data.method) {
          handleNotification(data.method, data.params)
        }
      } catch {
        addRawMessage('received', event.data)
      }
    }

    ws.onerror = () => {
      setStatus('error')
      addChatMessage('system', 'Connection error')
      endStreaming()
    }

    ws.onclose = () => {
      setStatus('disconnected')
      setSessionId(null)
      setRoundMetricsByPromptId({})
      activePromptIdRef.current = null
      activePromptRequestIdRef.current = null
      resumeRequestMapRef.current.clear()
      autoSessionCreatedRef.current = false
      addChatMessage('system', 'Disconnected')
      endStreaming()
    }
  }, [addRawMessage, addChatMessage, endStreaming, handleNotification, handleServerRequest])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setInitialized(false)
  }, [])

  const createSession = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    setSessionId(null)
    setRoundMetricsByPromptId({})
    activePromptIdRef.current = null

    const request = createJsonRpcRequest('session/new', {
      cwd: DEFAULT_CWD,
      mcpServers: [],
    } satisfies NewSessionRequest)

    addRawMessage('sent', request)
    wsRef.current.send(JSON.stringify(request))
  }, [addRawMessage])

  const resumeSession = useCallback((targetSessionId: string, auto = false) => {
    const resumeTarget = targetSessionId.trim()
    if (!resumeTarget) return

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (!auto) {
        addChatMessage('system', 'Cannot resume: not connected')
      }
      return
    }

    setRoundMetricsByPromptId({})
    activePromptIdRef.current = null
    setSessionId(null)

    if (!auto) {
      setChatMessages([])
      setRawMessages([])
    }

    const request = createJsonRpcRequest('session/resume', {
      sessionId: resumeTarget,
      cwd: DEFAULT_CWD,
      mcpServers: [],
    } satisfies ResumeSessionRequest)

    resumeRequestMapRef.current.set(request.id, {
      sessionId: resumeTarget,
      auto,
    })

    addRawMessage('sent', request)
    wsRef.current.send(JSON.stringify(request))
  }, [addRawMessage, addChatMessage])

  const sendPrompt = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !sessionId) return

    const promptId = addChatMessage('user', text)
    endStreaming()
    setAgentState('thinking')
    activePromptIdRef.current = promptId
    const modelLabel = modelOptions.find(option => option.id === selectedModelId)?.name

    setRoundMetricsByPromptId(prev => ({
      ...prev,
      [promptId]: {
        startedAt: Date.now(),
        status: 'processing',
        ...(modelLabel && { modelLabel }),
      },
    }))

    const request = createJsonRpcRequest('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text }],
    } satisfies PromptRequest)

    activePromptRequestIdRef.current = request.id
    addRawMessage('sent', request)
    wsRef.current.send(JSON.stringify(request))
  }, [
    sessionId,
    addRawMessage,
    addChatMessage,
    endStreaming,
    modelOptions,
    selectedModelId,
  ])

  const setMode = useCallback((modeId: string) => {
    setSelectedModeId(modeId)

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !sessionId) return

    const request = createJsonRpcRequest('session/set_mode', {
      sessionId,
      modeId,
    } satisfies SetSessionModeRequest)

    addRawMessage('sent', request)
    wsRef.current.send(JSON.stringify(request))
  }, [sessionId, addRawMessage])

  const setModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId)

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !sessionId) return

    const request = createJsonRpcRequest('session/set_model', {
      sessionId,
      modelId,
    } satisfies SetSessionModelRequest)

    addRawMessage('sent', request)
    wsRef.current.send(JSON.stringify(request))
  }, [sessionId, addRawMessage])

  const interrupt = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !sessionId) return

    cancelPendingPermissionRequests()

    const notification = {
      jsonrpc: '2.0',
      method: 'session/cancel',
      params: {
        sessionId,
      } satisfies CancelNotification,
    }

    addRawMessage('sent', notification)
    wsRef.current.send(JSON.stringify(notification))
  }, [sessionId, addRawMessage, addChatMessage, cancelPendingPermissionRequests])

  const clearMessages = useCallback(() => {
    setRawMessages([])
    setChatMessages([])
    setRoundMetricsByPromptId({})
    activePromptIdRef.current = null
    activePromptRequestIdRef.current = null
    resumeRequestMapRef.current.clear()
    endStreaming()
  }, [endStreaming])

  const setAutoNewSession = useCallback((value: boolean) => {
    setAutoNewSessionEnabled(value)
    persistAutoNewSessionEnabled(value)

    if (!value) {
      autoSessionCreatedRef.current = false
    }
  }, [])

  // Auto-connect on mount
  const autoConnectRef = useRef(false)
  useEffect(() => {
    if (!autoConnectRef.current) {
      autoConnectRef.current = true
      connect()
    }
  }, [connect])

  // Auto-initialize once connected (only when auto-new-session is enabled)
  useEffect(() => {
    if (!autoNewSessionEnabled) return

    if (status === 'connected' && !initialized && initRequestIdRef.current === null) {
      sendInitialize()
    }
  }, [status, initialized, sendInitialize, autoNewSessionEnabled])

  // Auto-bootstrap session once initialized (controlled by auto-new-session switch)
  useEffect(() => {
    if (!autoNewSessionEnabled) return

    if (status === 'connected' && initialized && !sessionId && !autoSessionCreatedRef.current) {
      autoSessionCreatedRef.current = true
      createSession()
    }
  }, [status, initialized, sessionId, createSession, autoNewSessionEnabled])

  return {
    status,
    sessionId,
    initialized,
    rawMessages,
    chatMessages,
    agentState,
    modeOptions,
    selectedModeId,
    modelOptions,
    selectedModelId,
    autoNewSessionEnabled,
    recentSessionIds,
    roundMetricsByPromptId,
    connect,
    disconnect,
    initialize: sendInitialize,
    createSession,
    resumeSession,
    setAutoNewSession,
    sendPrompt,
    setMode,
    setModel,
    interrupt,
    clearMessages,
    respondToPermission,
    respondToAskUserQuestion,
  }
}
