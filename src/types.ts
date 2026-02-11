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
  toolName?: string
  parentToolCallId?: string
  children?: ToolCall[]
}

export interface PermissionOption {
  kind: string
  name: string
  optionId: string
}

export interface AskUserQuestionOption {
  label: string
  description: string
}

export interface AskUserQuestion {
  question: string
  header: string
  options: AskUserQuestionOption[]
  multiSelect: boolean
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
  /** AskUserQuestion: 用户选择的答案 */
  answers?: Record<string, string>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'thought' | 'system' | 'tool_call_group' | 'permission_request'
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
  permissionRequest?: PermissionRequest
}

export interface RoundUsage {
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  costUsd?: number
}

export interface ChatRoundMetrics {
  startedAt: number
  endedAt?: number
  status: 'processing' | 'completed' | 'cancelled' | 'error'
  modelLabel?: string
  usage?: RoundUsage
}

export interface ModeOption {
  id: string
  name: string
  description?: string
}

export interface ModelOption {
  id: string
  name: string
  description?: string
}

export type SessionUpdate = SessionNotification
