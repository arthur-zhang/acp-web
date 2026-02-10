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

export function ToolCallBlock({ toolCalls }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false)
  const completedCount = toolCalls.filter(tc => tc.status === 'completed').length

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300
          py-1.5 px-2 rounded hover:bg-gray-800/50 transition-colors w-full text-left">
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
          <Wrench className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400 font-medium">
            {toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-500">
            ({completedCount}/{toolCalls.length} completed)
          </span>
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="pl-6 space-y-1 py-1">
          {toolCalls.map(tc => {
            const Icon = getToolIcon(tc.kind)
            return (
              <div key={tc.toolCallId}
                className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-gray-800/30">
                <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-gray-300 truncate flex-1">{tc.title}</span>
                {getStatusIcon(tc.status)}
              </div>
            )
          })}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
