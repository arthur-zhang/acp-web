import type { SessionNotification } from '@agentclientprotocol/sdk'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type AgentState = 'idle' | 'thinking' | 'tool_calling' | 'responding'

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

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'thought' | 'system' | 'tool_call_group'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
}

export type SessionUpdate = SessionNotification
