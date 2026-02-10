import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import {
  ChevronRight, Wrench, FileSearch, FileText,
  Terminal, Pencil, Check, Loader2, AlertCircle
} from 'lucide-react'
import type { ToolCall } from '../../types'

interface ToolCallBlockProps {
  toolCalls: ToolCall[]
}

function getToolIcon(kind?: string) {
  switch (kind?.toLowerCase()) {
    case 'glob':
    case 'grep':
    case 'search':
      return FileSearch
    case 'read':
      return FileText
    case 'edit':
    case 'write':
      return Pencil
    case 'bash':
    case 'execute':
      return Terminal
    default:
      return Wrench
  }
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

function getStatusBorderColor(status: string) {
  switch (status) {
    case 'completed':
      return 'border-l-green-500/40'
    case 'error':
      return 'border-l-red-500/40'
    default:
      return 'border-l-blue-500/40'
  }
}

function ToolCallItem({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = getToolIcon(tc.kind)
  const hasContent = !!tc.content

  return (
    <div className={`border-l-2 ${getStatusBorderColor(tc.status)} rounded bg-gray-800/30`}>
      <button
        onClick={() => hasContent && setExpanded(!expanded)}
        className={`flex items-center gap-2 text-sm py-1.5 px-2 w-full text-left ${
          hasContent ? 'cursor-pointer hover:bg-gray-800/50' : 'cursor-default'
        } transition-colors rounded`}
      >
        {hasContent && (
          <ChevronRight
            className={`w-3 h-3 text-gray-500 transition-transform duration-150 flex-shrink-0 ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        )}
        <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span className="text-gray-300 truncate flex-1">{tc.title}</span>
        {getStatusIcon(tc.status)}
      </button>
      {expanded && tc.content && (
        <div className="px-3 pb-2 pt-0">
          <pre className="text-xs text-gray-400 bg-gray-900/50 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
            {tc.content}
          </pre>
        </div>
      )}
    </div>
  )
}

export function ToolCallBlock({ toolCalls }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false)
  const completedCount = toolCalls.filter(tc => tc.status !== 'running').length
  const hasError = toolCalls.some(tc => tc.status === 'error')
  const allDone = toolCalls.every(tc => tc.status !== 'running')

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300
          py-1.5 px-2 rounded hover:bg-gray-800/50 transition-colors w-full text-left">
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
          {allDone
            ? (hasError
              ? <AlertCircle className="w-4 h-4 text-red-400" />
              : <Check className="w-4 h-4 text-green-400" />)
            : <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          }
          <span className={`font-medium ${allDone ? (hasError ? 'text-red-400' : 'text-green-400') : 'text-blue-400'}`}>
            {toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-500">
            ({completedCount}/{toolCalls.length} completed)
          </span>
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="pl-6 space-y-1 py-1">
          {toolCalls.map(tc => (
            <ToolCallItem key={tc.toolCallId} tc={tc} />
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
