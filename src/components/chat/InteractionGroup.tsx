import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import {
  ChevronRight,
  Plus,
  Brain,
  FileSearch,
  Terminal,
  FileText,
  Pencil,
  Wrench,
  Bot,
  Shield,
  MessageCircleQuestion,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { MarkdownRenderer } from './MarkdownRenderer'
import type { ChatMessage, ToolCall } from '../../types'
import { countAllToolCalls, countSubagentToolCalls } from './toolCallCounts'

interface InteractionGroupProps {
  messages: ChatMessage[]
  isLatest: boolean
  onRespondPermission?: (messageId: string, optionId: string) => void
  onRespondAskUserQuestion?: (messageId: string, answers: Record<string, string>) => void
}

interface FlattenedToolCall {
  toolCall: ToolCall
  depth: number
}

interface CompactRowProps {
  label: string
  icon: LucideIcon
  tag?: string
  details?: string
  indent?: number
  status?: ToolCall['status']
}

function countToolCalls(toolCalls: ToolCall[]): number {
  return toolCalls.reduce((sum, tc) => sum + countAllToolCalls(tc), 0)
}

function countSubagents(toolCalls: ToolCall[]): number {
  return toolCalls.reduce((sum, tc) => sum + countSubagentToolCalls(tc), 0)
}

function flattenToolCalls(toolCalls: ToolCall[], depth = 0): FlattenedToolCall[] {
  const rows: FlattenedToolCall[] = []

  for (const toolCall of toolCalls) {
    rows.push({ toolCall, depth })
    if (toolCall.children?.length) {
      if (toolCall.toolName !== 'Task') {
        rows.push(...flattenToolCalls(toolCall.children, depth + 1))
      }
    }
  }

  return rows
}

function getToolIcon(tc: ToolCall) {
  if (tc.toolName === 'Task') return Bot

  switch (tc.kind?.toLowerCase()) {
    case 'search':
    case 'glob':
    case 'grep':
      return FileSearch
    case 'bash':
    case 'execute':
      return Terminal
    case 'read':
      return FileText
    case 'edit':
    case 'write':
      return Pencil
    default:
      return Wrench
  }
}

function getToolLabel(tc: ToolCall): { name: string; tag?: string } {
  const name = tc.toolName?.trim() || tc.kind?.trim() || 'Tool'
  const title = tc.title?.trim()

  if (!title) {
    return { name }
  }

  const codeMatch = title.match(/`([^`]+)`/)
  if (codeMatch?.[1]) {
    return { name, tag: codeMatch[1] }
  }

  if (title !== name) {
    return { name, tag: title.replace(/`/g, '') }
  }

  return { name }
}

function normalizeDetails(details: string): string {
  return details
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\r\n/g, '\n')
}

function getStatusIcon(status?: ToolCall['status']) {
  switch (status) {
    case 'completed':
      return <Check className="h-3.5 w-3.5 text-green-400" />
    case 'error':
      return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
    default:
      return null
  }
}

function getCodeTag(value?: string): string | undefined {
  if (!value) return undefined
  const match = value.match(/`([^`]+)`/)
  if (match?.[1]) return match[1]
  return value.replace(/`/g, '').trim() || undefined
}

function getResolvedPermissionSummary(message: ChatMessage): { label: string; badge: string; icon: LucideIcon } | null {
  if (message.role !== 'permission_request' || !message.permissionRequest?.resolved) return null

  const rawInput = message.permissionRequest.toolCall.rawInput
  const hasQuestions = Array.isArray(rawInput?.questions)

  if (hasQuestions) {
    return {
      label: 'User input',
      badge: 'ANSWERED',
      icon: MessageCircleQuestion,
    }
  }

  const selectedOptionId = message.permissionRequest.selectedOptionId
  const selectedOption = message.permissionRequest.options.find(option => option.optionId === selectedOptionId)
  const badge = selectedOption?.name?.toUpperCase() ?? (selectedOptionId === 'cancelled' ? 'CANCELLED' : 'SELECTED')

  return {
    label: 'Permission',
    badge,
    icon: Shield,
  }
}

function CompactRow({ label, icon: Icon, tag, details, indent = 0, status }: CompactRowProps) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const canExpand = Boolean(details && details.trim().length > 0)

  return (
    <div className="space-y-1.5" style={{ marginLeft: `${indent * 20}px` }}>
      <button
        onClick={() => canExpand && setOpen((prev) => !prev)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left transition-colors ${
          canExpand ? 'hover:bg-gray-800/20 cursor-pointer' : 'cursor-default'
        }`}
      >
        {canExpand ? (
          open ? (
            <ChevronRight className="h-4 w-4 flex-shrink-0 rotate-90 text-gray-500 transition-transform duration-150" />
          ) : hovered ? (
            <Plus className="h-4 w-4 flex-shrink-0 text-gray-400" />
          ) : (
            <Icon className="h-4 w-4 flex-shrink-0 text-gray-500" />
          )
        ) : (
          <Icon className="h-4 w-4 flex-shrink-0 text-gray-500" />
        )}

        <span className="flex-shrink-0 text-sm font-medium text-gray-200">{label}</span>
        {tag && (
          <code className="min-w-0 max-w-[24rem] truncate rounded-md border border-gray-700/70 bg-gray-800/80 px-1.5 py-0.5 text-[11px] text-gray-300">
            {tag}
          </code>
        )}

        {status && (
          <span className="ml-auto flex-shrink-0">{getStatusIcon(status)}</span>
        )}
      </button>

      {open && details && (
        <div className="ml-6 rounded-xl border border-gray-700/70 bg-gray-800/40 px-3 py-2">
          <pre className="whitespace-pre-wrap break-words text-[12px] leading-5 text-gray-300">
            {normalizeDetails(details)}
          </pre>
        </div>
      )}
    </div>
  )
}

function SubagentRow({ taskToolCall, indent = 0 }: { taskToolCall: ToolCall; indent?: number }) {
  const [open, setOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const hasContent = Boolean(taskToolCall.content && taskToolCall.content.trim().length > 0)
  const hasChildren = Boolean(taskToolCall.children?.length)
  const canExpand = hasContent || hasChildren
  const promptTag = getCodeTag(taskToolCall.title)
  const promptPreview = promptTag ? promptTag.replace(/\s+/g, ' ').trim() : undefined
  const promptText = taskToolCall.promptText?.trim()
  const hasPromptDetails = Boolean(promptText)

  return (
    <div className="space-y-1.5" style={{ marginLeft: `${indent * 20}px` }}>
      <button
        onClick={() => canExpand && setOpen(prev => !prev)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left transition-colors ${
          canExpand ? 'hover:bg-gray-800/20 cursor-pointer' : 'cursor-default'
        }`}
      >
        {canExpand ? (
          open ? (
            <ChevronRight className="h-4 w-4 flex-shrink-0 rotate-90 text-gray-500 transition-transform duration-150" />
          ) : hovered ? (
            <Plus className="h-4 w-4 flex-shrink-0 text-gray-400" />
          ) : (
            <Bot className="h-4 w-4 flex-shrink-0 text-gray-500" />
          )
        ) : (
          <Bot className="h-4 w-4 flex-shrink-0 text-gray-500" />
        )}

        <span className="flex-shrink-0 text-sm font-medium text-gray-100">Agent</span>
        {promptPreview && (
          <code className="min-w-0 max-w-[28rem] truncate rounded-md border border-gray-700/70 bg-gray-800/70 px-1.5 py-0.5 text-[11px] text-gray-300">
            {promptPreview}
          </code>
        )}

        <span className="ml-auto flex-shrink-0">{getStatusIcon(taskToolCall.status)}</span>
      </button>

      {open && (
        <div className="ml-6 space-y-2 border-l border-gray-800/80 pl-3">
          <button
            onClick={() => hasPromptDetails && setPromptOpen(prev => !prev)}
            className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm text-gray-200 transition-colors ${
              hasPromptDetails ? 'hover:bg-gray-800/20 cursor-pointer' : 'cursor-default'
            }`}
          >
            {hasPromptDetails ? (
              <ChevronRight className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform duration-150 ${promptOpen ? 'rotate-90' : ''}`} />
            ) : (
              <span className="h-4 w-4 flex-shrink-0" />
            )}
            <span>Prompt</span>
          </button>

          {hasPromptDetails && promptOpen && (
            <div className="ml-6 rounded-xl border border-gray-700/70 bg-gray-800/35 px-3 py-2">
              <MarkdownRenderer content={promptText || ''} />
            </div>
          )}

          {taskToolCall.children?.length ? (
            flattenToolCalls(taskToolCall.children).map(({ toolCall, depth }) =>
              renderToolCallRow(toolCall, `sub-${taskToolCall.toolCallId}`, depth),
            )
          ) : null}

          {hasContent && (
            <div className="pt-1">
              <MarkdownRenderer content={normalizeDetails(taskToolCall.content || '')} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function renderToolCallRow(toolCall: ToolCall, keyPrefix: string, depth = 0) {
  if (toolCall.toolName === 'Task') {
    return (
      <SubagentRow
        key={`${keyPrefix}-${toolCall.toolCallId}`}
        taskToolCall={toolCall}
        indent={depth}
      />
    )
  }

  const Icon = getToolIcon(toolCall)
  const { name, tag } = getToolLabel(toolCall)

  return (
    <CompactRow
      key={`${keyPrefix}-${toolCall.toolCallId}`}
      label={name}
      icon={Icon}
      tag={tag}
      details={toolCall.content}
      indent={depth}
      status={toolCall.status}
    />
  )
}

export function InteractionGroup({
  messages,
  isLatest,
  onRespondPermission,
  onRespondAskUserQuestion,
}: InteractionGroupProps) {
  const [open, setOpen] = useState(isLatest)

  useEffect(() => {
    setOpen(isLatest)
  }, [isLatest])

  const summary = useMemo(() => {
    let toolCalls = 0
    let subagents = 0

    for (const msg of messages) {
      if (msg.role === 'tool_call_group' && msg.toolCalls) {
        toolCalls += countToolCalls(msg.toolCalls)
        subagents += countSubagents(msg.toolCalls)
      }
    }

    const messageCount = messages.filter(msg => msg.role !== 'tool_call_group').length

    return {
      messageCount,
      subagentCount: subagents,
      toolCallCount: toolCalls,
    }
  }, [messages])

  const summaryText = useMemo(() => {
    const parts: string[] = []

    if (summary.toolCallCount > 0) {
      parts.push(`${summary.toolCallCount} tool call${summary.toolCallCount !== 1 ? 's' : ''}`)
    }

    if (summary.messageCount > 0) {
      parts.push(`${summary.messageCount} message${summary.messageCount !== 1 ? 's' : ''}`)
    }

    if (summary.subagentCount > 0) {
      parts.push(`${summary.subagentCount} subagent${summary.subagentCount !== 1 ? 's' : ''}`)
    }

    return parts.length > 0 ? parts.join(', ') : 'details'
  }, [summary])

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300
            py-1.5 px-2 rounded hover:bg-gray-800/20 transition-colors w-full text-left"
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
          <span className="text-gray-400">{summaryText}</span>
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="space-y-2 pl-1 py-1">
          {messages.map((msg) => {
            const resolvedPermissionSummary = getResolvedPermissionSummary(msg)
            if (resolvedPermissionSummary) {
              const Icon = resolvedPermissionSummary.icon

              return (
                <div key={msg.id} className="flex items-center gap-2 px-1 py-0.5">
                  <Icon className="h-4 w-4 flex-shrink-0 text-gray-500" />
                  <span className="text-sm font-medium text-gray-200">{resolvedPermissionSummary.label}</span>
                  <span className="inline-flex items-center rounded-md border border-gray-700/80 bg-gray-800/50 px-2 py-0.5 text-[11px] font-medium tracking-wide text-gray-300">
                    {resolvedPermissionSummary.badge}
                  </span>
                </div>
              )
            }

            if (msg.role === 'thought') {
              const preview = msg.content?.trim()
              return (
                <CompactRow
                  key={msg.id}
                  label="Thinking"
                  icon={Brain}
                  tag={preview}
                  details={msg.content}
                />
              )
            }

            if (msg.role === 'tool_call_group' && msg.toolCalls?.length) {
              return flattenToolCalls(msg.toolCalls).map(({ toolCall, depth }) =>
                renderToolCallRow(toolCall, msg.id, depth),
              )
            }

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                onRespondPermission={onRespondPermission}
                onRespondAskUserQuestion={onRespondAskUserQuestion}
              />
            )
          })}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
