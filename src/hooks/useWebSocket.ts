import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  NewSessionRequest,
  PromptRequest,
  SessionNotification,
  ContentBlock
} from '@agentclientprotocol/sdk'
import type { ConnectionStatus, RawMessage, ChatMessage, AgentState, ToolCall, PermissionOption } from '../types'

const WS_URL = 'ws://127.0.0.1:3000/ws'

let requestId = 1

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

type StreamingRole = 'assistant' | 'thought' | null

export function useWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [rawMessages, setRawMessages] = useState<RawMessage[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [agentState, setAgentState] = useState<AgentState>('idle')
  const [initialized, setInitialized] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const initRequestIdRef = useRef<number | null>(null)
  const streamingRoleRef = useRef<StreamingRole>(null)
  const streamingMessageIdRef = useRef<string | null>(null)
  const toolCallGroupIdRef = useRef<string | null>(null)

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

  const sendInitialize = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const request = createJsonRpcRequest('initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
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

        setChatMessages(prev => {
          const existingGroup = prev.find(
            msg => msg.role === 'tool_call_group' && msg.toolCalls?.some(tc => tc.toolCallId === toolCallId)
          )

          if (existingGroup) {
            toolCallGroupIdRef.current = existingGroup.id
            return prev.map(msg => {
              if (msg.id !== existingGroup.id || msg.role !== 'tool_call_group') return msg
              return {
                ...msg,
                toolCalls: msg.toolCalls?.map(tc => {
                  if (tc.toolCallId !== toolCallId) return tc
                  return {
                    ...tc,
                    ...(status && { status }),
                    ...(title && { title }),
                    ...(kind && { kind }),
                    ...(contentText && { content: contentText }),
                    ...(locations !== undefined && { locations }),
                  }
                }),
              }
            })
          }

          const newToolCall: ToolCall = {
            toolCallId,
            title: title || 'Tool Call',
            status: status || 'running',
            ...(kind && { kind }),
            ...(contentText && { content: contentText }),
            ...(locations !== undefined && { locations }),
          }

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
          // Handle initialize response
          if (data.id === initRequestIdRef.current) {
            initRequestIdRef.current = null
            setInitialized(true)
            addChatMessage('system', `Initialized (agent: ${data.result.agentInfo?.name || 'unknown'})`)
          } else if (data.result.sessionId) {
            setSessionId(data.result.sessionId)
            addChatMessage('system', 'Session ready')
          }
          if (data.result.stopReason) {
            endStreaming()
          }
        } else if (data.error) {
          addChatMessage('system', `Error: ${data.error.message}`)
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

    const request = createJsonRpcRequest('session/new', {
      cwd: '/tmp',
      mcpServers: [],
    } satisfies NewSessionRequest)

    addRawMessage('sent', request)
    wsRef.current.send(JSON.stringify(request))
  }, [addRawMessage])

  const sendPrompt = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !sessionId) return

    addChatMessage('user', text)
    endStreaming()

    const request = createJsonRpcRequest('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text }],
    } satisfies PromptRequest)

    addRawMessage('sent', request)
    wsRef.current.send(JSON.stringify(request))
  }, [sessionId, addRawMessage, addChatMessage, endStreaming])

  const clearMessages = useCallback(() => {
    setRawMessages([])
    setChatMessages([])
    endStreaming()
  }, [endStreaming])

  // Auto-connect on mount
  const autoConnectRef = useRef(false)
  useEffect(() => {
    if (!autoConnectRef.current) {
      autoConnectRef.current = true
      connect()
    }
  }, [connect])

  // Auto-initialize once connected
  const autoInitRef = useRef(false)
  useEffect(() => {
    if (status === 'connected' && !initialized && !autoInitRef.current) {
      autoInitRef.current = true
      sendInitialize()
    }
  }, [status, initialized, sendInitialize])

  // Auto-create session once initialized
  const autoSessionRef = useRef(false)
  useEffect(() => {
    if (status === 'connected' && initialized && !sessionId && !autoSessionRef.current) {
      autoSessionRef.current = true
      createSession()
    }
  }, [status, initialized, sessionId, createSession])

  return {
    status,
    sessionId,
    initialized,
    rawMessages,
    chatMessages,
    agentState,
    connect,
    disconnect,
    createSession,
    sendPrompt,
    clearMessages,
    respondToPermission,
  }
}
