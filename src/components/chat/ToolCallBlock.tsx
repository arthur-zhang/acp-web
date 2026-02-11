import { useEffect, useState } from 'react'
import { ChevronRight, Check, Loader2, AlertCircle, Plus, FileSearch, Terminal, FileText, Pencil, Wrench, Bot } from 'lucide-react'
import type { ToolCall } from '../../types'

interface ToolCallBlockProps {
  toolCalls: ToolCall[]
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <Check className="w-3.5 h-3.5 text-green-400" />
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />
    default:
      return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
  }
}

function getKindIcon(tc: ToolCall) {
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

function normalizeContent(content: string): string {
  return content
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\r\n/g, '\n')
}

function isShellTool(tc: ToolCall): boolean {
  const kind = tc.kind?.toLowerCase()
  const toolName = tc.toolName?.toLowerCase()
  return kind === 'bash' || kind === 'execute' || toolName === 'bash' || toolName === 'execute'
}

function formatTerminalTranscript(content: string, tc: ToolCall): string {
  const normalized = normalizeContent(content)
  if (!isShellTool(tc)) return normalized

  const lines = normalized.split('\n')
  let commandMarked = false

  return lines
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line

      if (/^[>$%]\s/.test(trimmed)) {
        commandMarked = true
        return line.replace(/^\s*[>$%]\s*/, '> ')
      }

      if (!commandMarked) {
        commandMarked = true
        return `> ${line}`
      }

      return line
    })
    .join('\n')
}

function getTitleCodeLabel(title: string): string {
  const codeMatch = title.match(/`([^`]+)`/)
  if (codeMatch?.[1]) return codeMatch[1]

  return title.replace(/`/g, '').trim()
}

function getHeaderLabels(tc: ToolCall): { toolNameLabel: string; titleLabel?: string } {
  const toolNameLabel = tc.toolName?.trim() || tc.kind?.trim() || 'Tool'
  const title = tc.title?.trim()

  if (title && title !== toolNameLabel) {
    return { toolNameLabel, titleLabel: getTitleCodeLabel(title) }
  }

  return { toolNameLabel }
}

function ToolCallItem({ tc, depth = 0 }: { tc: ToolCall; depth?: number }) {
  const hasContent = Boolean(tc.content)
  const hasChildren = Boolean(tc.children?.length)
  const canExpand = hasContent || hasChildren
  const [open, setOpen] = useState(tc.status === 'running')
  const [hovered, setHovered] = useState(false)
  const { toolNameLabel, titleLabel } = getHeaderLabels(tc)
  const KindIcon = getKindIcon(tc)
  const showExpandHint = canExpand && !open && hovered

  useEffect(() => {
    if (tc.status !== 'running') {
      setOpen(false)
    }
  }, [tc.status])

  return (
    <div className={depth > 0 ? 'ml-5 space-y-2' : 'space-y-2'}>
      <button
        onClick={() => canExpand && setOpen((prev) => !prev)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-gray-200 transition-colors ${
          canExpand ? 'hover:bg-gray-800/20 cursor-pointer' : 'cursor-default'
        }`}
      >
        {showExpandHint ? (
          <Plus className="h-4 w-4 flex-shrink-0 text-gray-400" />
        ) : !open ? (
          <KindIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
        ) : (
          <ChevronRight
            className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform duration-150 ${
              open && canExpand ? 'rotate-90' : ''
            }`}
          />
        )}
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="flex-shrink-0 text-sm font-medium text-gray-100">{toolNameLabel}</span>
          {titleLabel && (
            <code className="inline-block max-w-[24rem] truncate rounded-md border border-gray-700/70 bg-gray-800/80 px-1.5 py-0.5 text-xs text-gray-200">
              {titleLabel}
            </code>
          )}
        </div>
        <span className="ml-auto flex-shrink-0">{getStatusIcon(tc.status)}</span>
      </button>

      {open && hasContent && (
        <div className="ml-8 rounded-2xl border border-gray-700/80 bg-gray-800/45 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <pre className="whitespace-pre-wrap break-words text-[13px] leading-6 text-gray-100">
            {formatTerminalTranscript(tc.content || '', tc)}
          </pre>
        </div>
      )}

      {open && hasChildren && (
        <div className="space-y-2">
          {tc.children!.map((child) => (
            <ToolCallItem key={child.toolCallId} tc={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ToolCallBlock({ toolCalls }: ToolCallBlockProps) {
  return (
    <div className="space-y-2 toolcall-font">
      {toolCalls.map((tc) => (
        <ToolCallItem key={tc.toolCallId} tc={tc} />
      ))}
    </div>
  )
}
