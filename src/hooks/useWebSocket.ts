import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  NewSessionRequest,
  PromptRequest,
  SessionNotification,
  ContentBlock
} from '@agentclientprotocol/sdk'
import type { ConnectionStatus, RawMessage, ChatMessage, AgentState, ToolCall } from '../types'

const WS_URL = 'ws://127.0.0.1:3000/ws'

let requestId = 1

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

  const sendInitialize = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const request = createJsonRpcRequest('initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
        terminal: true,
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

      if (update.sessionUpdate === 'agent_message_chunk') {
        const content = update.content as ContentBlock
        if (content.type === 'text') {
          appendToStreamingMessage('assistant', content.text)
        }
      }

      if (update.sessionUpdate === 'agent_thought_chunk') {
        const content = update.content as ContentBlock
        if (content.type === 'text') {
          appendToStreamingMessage('thought', content.text)
        }
      }

      if (update.sessionUpdate === 'tool_call') {
        setAgentState('tool_calling')
        endStreaming()
        // Re-set agent state after endStreaming resets it
        setAgentState('tool_calling')

        const newToolCall: ToolCall = {
          toolCallId: (update.toolCallId as string) || crypto.randomUUID(),
          title: (update.title as string) || 'Tool Call',
          status: 'running',
          kind: update.kind as string | undefined,
        }

        if (!toolCallGroupIdRef.current) {
          const groupId = crypto.randomUUID()
          toolCallGroupIdRef.current = groupId
          setChatMessages(prev => [...prev, {
            id: groupId,
            role: 'tool_call_group' as const,
            content: '',
            timestamp: new Date(),
            toolCalls: [newToolCall],
          }])
        } else {
          const groupId = toolCallGroupIdRef.current
          setChatMessages(prev => prev.map(msg =>
            msg.id === groupId
              ? { ...msg, toolCalls: [...(msg.toolCalls || []), newToolCall] }
              : msg
          ))
        }
      }

      if (update.sessionUpdate === 'tool_call_update') {
        const updateToolCallId = update.toolCallId as string
        const updateStatus = update.status as string | undefined
        const updateContent = update.content as Record<string, unknown> | undefined
        setChatMessages(prev => prev.map(msg => {
          if (msg.role !== 'tool_call_group') return msg
          const updatedCalls = msg.toolCalls?.map(tc => {
            if (tc.toolCallId !== updateToolCallId) return tc
            const updated = { ...tc }
            if (updateStatus) {
              updated.status = updateStatus as ToolCall['status']
            }
            if (updateContent && typeof updateContent === 'object') {
              updated.content = (updateContent.text as string) || ''
            }
            return updated
          })
          return { ...msg, toolCalls: updatedCalls }
        }))
      }
    }
  }, [appendToStreamingMessage, endStreaming])

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

        if (data.result) {
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
  }, [addRawMessage, addChatMessage, endStreaming, handleNotification])

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
  }
}
