import type { SessionNotification } from '@agentclientprotocol/sdk'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type AgentState = 'idle' | 'thinking' | 'tool_calling' | 'responding' | 'awaiting_permission'

export interface RawMessage {
  id: string
  timestamp: Date
  direction: 'sent' | 'received'
  data: unknown
}

export interface ToolCall {
  toolCallId: string
  title: string
  status: 'running' | 'completed' | 'error'
  kind?: string
  content?: string
  locations?: unknown
}

export interface PermissionOption {
  kind: string
  name: string
  optionId: string
}

export interface PermissionRequest {
  jsonRpcId: number
  options: PermissionOption[]
  toolCall: {
    toolCallId: string
    title: string
    rawInput?: Record<string, unknown>
  }
  resolved: boolean
  selectedOptionId?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'thought' | 'system' | 'tool_call_group' | 'permission_request'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
  permissionRequest?: PermissionRequest
}

export type SessionUpdate = SessionNotification
