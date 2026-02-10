import { useState, useEffect, useRef, useMemo } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ArrowUpRight, ArrowDownLeft, ChevronRight, Trash2 } from 'lucide-react'
import type { RawMessage } from '../types'

type GroupedItem =
  | { type: 'single'; message: RawMessage }
  | { type: 'chunk_group'; messages: RawMessage[] }

function isAgentMessageChunk(msg: RawMessage): boolean {
  if (typeof msg.data === 'object' && msg.data !== null) {
    const obj = msg.data as Record<string, unknown>
    if (obj.method === 'session/update' && obj.params) {
      const params = obj.params as Record<string, unknown>
      const update = params.update as Record<string, unknown> | undefined
      return update?.sessionUpdate === 'agent_message_chunk'
    }
  }
  return false
}

function groupMessages(messages: RawMessage[]): GroupedItem[] {
  const result: GroupedItem[] = []
  let i = 0
  while (i < messages.length) {
    if (isAgentMessageChunk(messages[i])) {
      const chunks: RawMessage[] = [messages[i]]
      while (i + 1 < messages.length && isAgentMessageChunk(messages[i + 1])) {
        i++
        chunks.push(messages[i])
      }
      if (chunks.length > 1) {
        result.push({ type: 'chunk_group', messages: chunks })
      } else {
        result.push({ type: 'single', message: chunks[0] })
      }
    } else {
      result.push({ type: 'single', message: messages[i] })
    }
    i++
  }
  return result
}

interface DebugPanelProps {
  messages: RawMessage[]
  onClear: () => void
}

export function DebugPanel({ messages, onClear }: DebugPanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const grouped = useMemo(() => groupMessages(messages), [messages])

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400">WebSocket Debug</h2>
        <button
          onClick={onClear}
          className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800
            rounded transition-colors"
          aria-label="Clear messages"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea.Root className="flex-1 overflow-hidden">
        <ScrollArea.Viewport ref={viewportRef} className="h-full w-full p-2">
          <div className="space-y-0.5">
            {grouped.map((item, idx) =>
              item.type === 'single' ? (
                <MessageItem key={item.message.id} message={item.message} />
              ) : (
                <ChunkGroupItem key={`chunk-group-${idx}`} messages={item.messages} />
              )
            )}
          </div>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          className="flex select-none touch-none p-0.5 bg-transparent transition-colors
            duration-150 ease-out hover:bg-gray-900 data-[orientation=vertical]:w-2"
          orientation="vertical"
        >
          <ScrollArea.Thumb className="flex-1 bg-gray-700 rounded-full relative" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  )
}

function getMessageBadge(data: unknown): { label: string; color: string } {
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (obj.method && obj.id) return { label: 'REQ', color: 'text-yellow-400 bg-yellow-400/10' }
    if (obj.method && !obj.id) return { label: 'NOTIF', color: 'text-purple-400 bg-purple-400/10' }
    if (obj.result) return { label: 'RES', color: 'text-green-400 bg-green-400/10' }
    if (obj.error) return { label: 'ERR', color: 'text-red-400 bg-red-400/10' }
  }
  return { label: 'RAW', color: 'text-gray-400 bg-gray-400/10' }
}

function getMessagePreview(data: unknown): string {
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (obj.method) {
      if (obj.method === 'session/update' && obj.params) {
        const params = obj.params as Record<string, unknown>
        const update = params.update as Record<string, unknown>
        if (update?.sessionUpdate) {
          return `session/update: ${update.sessionUpdate}`
        }
      }
      return `${obj.method}`
    }
    if (obj.result) return 'result'
    if (obj.error) return `error: ${(obj.error as Record<string, unknown>).message}`
  }
  return String(data).slice(0, 50)
}

function MessageItem({ message }: { message: RawMessage }) {
  const [open, setOpen] = useState(false)
  const isSent = message.direction === 'sent'
  const badge = getMessageBadge(message.data)

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono
            hover:bg-gray-800/50 transition-colors`}
        >
          <div className="flex items-center gap-1.5">
            <ChevronRight
              className={`w-3 h-3 text-gray-600 transition-transform duration-150 flex-shrink-0
                ${open ? 'rotate-90' : ''}`}
            />
            {isSent ? (
              <ArrowUpRight className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            ) : (
              <ArrowDownLeft className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            )}
            <span className={`px-1 py-0.5 rounded text-[10px] font-semibold ${badge.color}`}>
              {badge.label}
            </span>
            <span className="text-gray-500 text-[10px] flex-shrink-0">
              {message.timestamp.toLocaleTimeString()}
            </span>
            <span className="text-gray-400 truncate flex-1">
              {getMessagePreview(message.data)}
            </span>
          </div>
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <pre className="px-3 py-2 ml-5 bg-gray-900/50 rounded text-[11px] overflow-x-auto
          text-gray-400 border-l-2 border-gray-800">
          {JSON.stringify(message.data, null, 2)}
        </pre>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

function ChunkGroupItem({ messages }: { messages: RawMessage[] }) {
  const [open, setOpen] = useState(false)
  const first = messages[0]
  const last = messages[messages.length - 1]

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono
            hover:bg-gray-800/50 transition-colors`}
        >
          <div className="flex items-center gap-1.5">
            <ChevronRight
              className={`w-3 h-3 text-gray-600 transition-transform duration-150 flex-shrink-0
                ${open ? 'rotate-90' : ''}`}
            />
            <ArrowDownLeft className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="px-1 py-0.5 rounded text-[10px] font-semibold text-purple-400 bg-purple-400/10">
              NOTIF
            </span>
            <span className="px-1 py-0.5 rounded text-[10px] font-semibold text-cyan-400 bg-cyan-400/10">
              x{messages.length}
            </span>
            <span className="text-gray-500 text-[10px] flex-shrink-0">
              {first.timestamp.toLocaleTimeString()} - {last.timestamp.toLocaleTimeString()}
            </span>
            <span className="text-gray-400 truncate flex-1">
              session/update: agent_message_chunk
            </span>
          </div>
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="ml-5 border-l-2 border-cyan-900/50 space-y-0.5 py-1">
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
