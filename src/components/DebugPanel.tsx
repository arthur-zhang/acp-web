import { useState, useEffect, useRef, useMemo } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ArrowUpRight, ArrowDownLeft, ChevronRight, FolderOpen, Plug, RotateCcw, Trash2, Unplug } from 'lucide-react'
import type { ConnectionStatus, RawMessage } from '../types'

type ChunkType = 'agent_message_chunk' | 'agent_thought_chunk'

type GroupedItem =
  | { type: 'single'; message: RawMessage }
  | { type: 'chunk_group'; messages: RawMessage[]; chunkType: ChunkType }

function getChunkType(msg: RawMessage): ChunkType | null {
  if (typeof msg.data === 'object' && msg.data !== null) {
    const obj = msg.data as Record<string, unknown>
    if (obj.method === 'session/update' && obj.params) {
      const params = obj.params as Record<string, unknown>
      const update = params.update as Record<string, unknown> | undefined
      const sessionUpdate = update?.sessionUpdate
      if (sessionUpdate === 'agent_message_chunk' || sessionUpdate === 'agent_thought_chunk') {
        return sessionUpdate
      }
    }
  }
  return null
}

function groupMessages(messages: RawMessage[]): GroupedItem[] {
  const result: GroupedItem[] = []
  let i = 0
  while (i < messages.length) {
    const chunkType = getChunkType(messages[i])

    if (chunkType) {
      const chunks: RawMessage[] = [messages[i]]
      while (i + 1 < messages.length && getChunkType(messages[i + 1]) === chunkType) {
        i++
        chunks.push(messages[i])
      }

      if (chunks.length > 1) {
        result.push({ type: 'chunk_group', messages: chunks, chunkType })
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
  status: ConnectionStatus
  initialized: boolean
  sessionId: string | null
  autoNewSessionEnabled: boolean
  recentSessionIds: string[]
  isLoadingSession: boolean
  messages: RawMessage[]
  onConnect: () => void
  onDisconnect: () => void
  onInitialize: () => void
  onCreateSession: () => void
  onLoadSession: (sessionId: string) => void
  onResumeSession: (sessionId: string) => void
  onToggleAutoNewSession: (enabled: boolean) => void
  onClear: () => void
}

function getStatusStyles(status: ConnectionStatus): { label: string; className: string } {
  switch (status) {
    case 'connected':
      return { label: 'Connected', className: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' }
    case 'connecting':
      return { label: 'Connecting', className: 'text-amber-300 bg-amber-500/15 border-amber-500/30' }
    case 'error':
      return { label: 'Error', className: 'text-red-300 bg-red-500/15 border-red-500/30' }
    default:
      return { label: 'Disconnected', className: 'text-gray-300 bg-gray-700/30 border-gray-600/40' }
  }
}

export function DebugPanel({
  status,
  initialized,
  sessionId,
  autoNewSessionEnabled,
  recentSessionIds,
  isLoadingSession,
  messages,
  onConnect,
  onDisconnect,
  onInitialize,
  onCreateSession,
  onLoadSession,
  onResumeSession,
  onToggleAutoNewSession,
  onClear,
}: DebugPanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const grouped = useMemo(() => groupMessages(messages), [messages])
  const [resumePopoverOpen, setResumePopoverOpen] = useState(false)
  const [resumeSessionInput, setResumeSessionInput] = useState('')
  const [loadPopoverOpen, setLoadPopoverOpen] = useState(false)
  const [loadSessionInput, setLoadSessionInput] = useState('')
  const loadButtonRef = useRef<HTMLButtonElement>(null)
  const loadPopoverRef = useRef<HTMLDivElement>(null)
  const loadInputRef = useRef<HTMLInputElement>(null)
  const resumeButtonRef = useRef<HTMLButtonElement>(null)
  const resumePopoverRef = useRef<HTMLDivElement>(null)
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const statusStyles = getStatusStyles(status)
  const canConnect = status === 'disconnected' || status === 'error'
  const canDisconnect = status === 'connected' || status === 'connecting'
  const canInitialize = status === 'connected' && !initialized
  const canStartSession = status === 'connected' && initialized
  const canResume = status === 'connected' && initialized
  const canLoad = status === 'connected' && initialized && !isLoadingSession

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!resumePopoverOpen) return

    const focusTimer = window.setTimeout(() => {
      resumeInputRef.current?.focus()
      resumeInputRef.current?.select()
    }, 0)

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (resumePopoverRef.current?.contains(target)) return
      if (resumeButtonRef.current?.contains(target)) return
      setResumePopoverOpen(false)
    }

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setResumePopoverOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [resumePopoverOpen])

  useEffect(() => {
    if (!loadPopoverOpen) return

    const focusTimer = window.setTimeout(() => {
      loadInputRef.current?.focus()
      loadInputRef.current?.select()
    }, 0)

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (loadPopoverRef.current?.contains(target)) return
      if (loadButtonRef.current?.contains(target)) return
      setLoadPopoverOpen(false)
    }

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLoadPopoverOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [loadPopoverOpen])

  const handleResume = () => {
    const trimmed = resumeSessionInput.trim()
    if (!trimmed) return
    onResumeSession(trimmed)
    setResumeSessionInput('')
    setResumePopoverOpen(false)
  }

  const handleQuickResume = (targetSessionId: string) => {
    const trimmed = targetSessionId.trim()
    if (!trimmed) return
    onResumeSession(trimmed)
    setResumeSessionInput('')
    setResumePopoverOpen(false)
  }

  const toggleResumePopover = () => {
    if (!canResume) return
    setResumePopoverOpen((prev) => {
      const next = !prev
      if (!prev) {
        setResumeSessionInput(sessionId ?? recentSessionIds[0] ?? '')
      }
      return next
    })
  }

  const handleLoad = () => {
    const trimmed = loadSessionInput.trim()
    if (!trimmed) return
    onLoadSession(trimmed)
    setLoadSessionInput('')
    setLoadPopoverOpen(false)
  }

  const handleQuickLoad = (targetSessionId: string) => {
    const trimmed = targetSessionId.trim()
    if (!trimmed) return
    onLoadSession(trimmed)
    setLoadSessionInput('')
    setLoadPopoverOpen(false)
  }

  const toggleLoadPopover = () => {
    if (!canLoad) return
    setLoadPopoverOpen((prev) => {
      const next = !prev
      if (!prev) {
        setLoadSessionInput(sessionId ?? recentSessionIds[0] ?? '')
      }
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-gray-400">WebSocket Debug</h2>
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] ${statusStyles.className}`}>
              {statusStyles.label}
            </span>
          </div>
          <button
            onClick={onClear}
            className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
            aria-label="Clear messages"
            title="Clear messages"
            type="button"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onToggleAutoNewSession(!autoNewSessionEnabled)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-700/80 bg-gray-900/35 px-2 text-[11px] text-gray-200
              transition-colors hover:bg-gray-800/50"
            title="Toggle automatic new session after initialization"
          >
            <span>Auto New Session</span>
            <span
              className={`inline-flex h-4 w-7 items-center rounded-full border transition-colors ${
                autoNewSessionEnabled
                  ? 'border-emerald-400/40 bg-emerald-500/30 justify-end'
                  : 'border-gray-600/60 bg-gray-700/40 justify-start'
              }`}
            >
              <span
                className={`mx-0.5 h-2.5 w-2.5 rounded-full ${
                  autoNewSessionEnabled ? 'bg-emerald-200' : 'bg-gray-300'
                }`}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={onConnect}
            disabled={!canConnect}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-700/80 bg-gray-900/35 px-2 text-[11px] text-gray-200
              transition-colors hover:bg-gray-800/50 disabled:opacity-45 disabled:hover:bg-gray-900/35"
          >
            <Plug className="h-3.5 w-3.5" />
            Connect
          </button>

          <button
            type="button"
            onClick={onInitialize}
            disabled={!canInitialize}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-700/80 bg-gray-900/35 px-2 text-[11px] text-gray-200
              transition-colors hover:bg-gray-800/50 disabled:opacity-45 disabled:hover:bg-gray-900/35"
          >
            Initialize
          </button>

          <button
            type="button"
            onClick={onCreateSession}
            disabled={!canStartSession}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-700/80 bg-gray-900/35 px-2 text-[11px] text-gray-200
              transition-colors hover:bg-gray-800/50 disabled:opacity-45 disabled:hover:bg-gray-900/35"
          >
            New Session
          </button>

          <div className="relative">
            <button
              ref={loadButtonRef}
              type="button"
              onClick={toggleLoadPopover}
              disabled={!canLoad}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-700/80 bg-gray-900/35 px-2 text-[11px] text-gray-200
                transition-colors hover:bg-gray-800/50 disabled:opacity-45 disabled:hover:bg-gray-900/35"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {isLoadingSession ? 'Loading...' : 'Load'}
            </button>

            {loadPopoverOpen && (
              <div
                ref={loadPopoverRef}
                className="absolute top-[calc(100%+8px)] left-0 z-50 w-[320px] rounded-xl border border-gray-800/90 bg-gray-900/95 p-2.5
                  shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              >
                <div className="mb-1.5 text-[11px] text-gray-400">Load session (replay history)</div>
                <input
                  ref={loadInputRef}
                  value={loadSessionInput}
                  onChange={(event) => setLoadSessionInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleLoad()
                    }
                  }}
                  placeholder="Enter session ID"
                  className="w-full rounded-md border border-gray-800/90 bg-gray-950/60 px-2.5 py-1.5 text-[12px] text-gray-200
                    placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                />

                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLoadPopoverOpen(false)}
                    className="rounded-md border border-gray-800/90 bg-gray-900/30 px-2 py-1 text-[11px] text-gray-300 transition-colors
                      hover:bg-gray-800/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleLoad}
                    disabled={!loadSessionInput.trim() || isLoadingSession}
                    className="rounded-md border border-blue-500/40 bg-blue-500/15 px-2 py-1 text-[11px] text-blue-200 transition-colors
                      hover:bg-blue-500/25 disabled:border-gray-800/90 disabled:bg-gray-900/30 disabled:text-gray-600"
                  >
                    {isLoadingSession ? 'Loading...' : 'Load'}
                  </button>
                </div>

                {recentSessionIds.length > 0 && (
                  <div className="mt-2 border-t border-gray-800/70 pt-2">
                    <div className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-500">Recent</div>
                    <div className="space-y-1">
                      {recentSessionIds.map((recentSessionId) => (
                        <button
                          key={`load-${recentSessionId}`}
                          type="button"
                          onClick={() => handleQuickLoad(recentSessionId)}
                          disabled={isLoadingSession}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-800/70 bg-gray-900/30 px-2 py-1.5 text-left
                            text-[11px] text-gray-300 transition-colors hover:bg-gray-800/40 disabled:opacity-50 disabled:hover:bg-gray-900/30"
                        >
                          <span className="truncate font-mono">{recentSessionId}</span>
                          {recentSessionId === sessionId && (
                            <span className="rounded border border-blue-500/40 bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-200">
                              Current
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              ref={resumeButtonRef}
              type="button"
              onClick={toggleResumePopover}
              disabled={!canResume}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-700/80 bg-gray-900/35 px-2 text-[11px] text-gray-200
                transition-colors hover:bg-gray-800/50 disabled:opacity-45 disabled:hover:bg-gray-900/35"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resume
            </button>

            {resumePopoverOpen && (
              <div
                ref={resumePopoverRef}
                className="absolute top-[calc(100%+8px)] left-0 z-50 w-[320px] rounded-xl border border-gray-800/90 bg-gray-900/95 p-2.5
                  shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              >
                <div className="mb-1.5 text-[11px] text-gray-400">Resume session</div>
                <input
                  ref={resumeInputRef}
                  value={resumeSessionInput}
                  onChange={(event) => setResumeSessionInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleResume()
                    }
                  }}
                  placeholder="Enter session ID"
                  className="w-full rounded-md border border-gray-800/90 bg-gray-950/60 px-2.5 py-1.5 text-[12px] text-gray-200
                    placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                />

                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setResumePopoverOpen(false)}
                    className="rounded-md border border-gray-800/90 bg-gray-900/30 px-2 py-1 text-[11px] text-gray-300 transition-colors
                      hover:bg-gray-800/40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResume}
                    disabled={!resumeSessionInput.trim()}
                    className="rounded-md border border-blue-500/40 bg-blue-500/15 px-2 py-1 text-[11px] text-blue-200 transition-colors
                      hover:bg-blue-500/25 disabled:border-gray-800/90 disabled:bg-gray-900/30 disabled:text-gray-600"
                  >
                    Resume
                  </button>
                </div>

                {recentSessionIds.length > 0 && (
                  <div className="mt-2 border-t border-gray-800/70 pt-2">
                    <div className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-500">Recent</div>
                    <div className="space-y-1">
                      {recentSessionIds.map((recentSessionId) => (
                        <button
                          key={recentSessionId}
                          type="button"
                          onClick={() => handleQuickResume(recentSessionId)}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-800/70 bg-gray-900/30 px-2 py-1.5 text-left
                            text-[11px] text-gray-300 transition-colors hover:bg-gray-800/40"
                        >
                          <span className="truncate font-mono">{recentSessionId}</span>
                          {recentSessionId === sessionId && (
                            <span className="rounded border border-blue-500/40 bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-200">
                              Current
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onDisconnect}
            disabled={!canDisconnect}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-700/80 bg-gray-900/35 px-2 text-[11px] text-gray-200
              transition-colors hover:bg-gray-800/50 disabled:opacity-45 disabled:hover:bg-gray-900/35"
          >
            <Unplug className="h-3.5 w-3.5" />
            Disconnect
          </button>

          {sessionId && (
            <span className="ml-1 max-w-[260px] truncate rounded-md border border-gray-800/80 bg-gray-900/25 px-2 py-1 text-[10px] font-mono text-gray-500">
              {sessionId}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea.Root className="flex-1 overflow-hidden">
        <ScrollArea.Viewport ref={viewportRef} className="h-full w-full p-2">
          <div className="space-y-0.5">
            {grouped.map((item, idx) =>
              item.type === 'single' ? (
                <MessageItem key={item.message.id} message={item.message} />
              ) : (
                <ChunkGroupItem
                  key={`chunk-group-${item.chunkType}-${idx}`}
                  messages={item.messages}
                  chunkType={item.chunkType}
                />
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

function getChunkStyle(chunkType: ChunkType): { counterBadgeClass: string; borderClass: string } {
  switch (chunkType) {
    case 'agent_thought_chunk':
      return {
        counterBadgeClass: 'text-indigo-400 bg-indigo-400/10',
        borderClass: 'border-indigo-900/50',
      }
    default:
      return {
        counterBadgeClass: 'text-cyan-400 bg-cyan-400/10',
        borderClass: 'border-cyan-900/50',
      }
  }
}

function ChunkGroupItem({ messages, chunkType }: { messages: RawMessage[]; chunkType: ChunkType }) {
  const [open, setOpen] = useState(false)
  const first = messages[0]
  const last = messages[messages.length - 1]
  const chunkStyle = getChunkStyle(chunkType)

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
            <span className={`px-1 py-0.5 rounded text-[10px] font-semibold ${chunkStyle.counterBadgeClass}`}>
              x{messages.length}
            </span>
            <span className="text-gray-500 text-[10px] flex-shrink-0">
              {first.timestamp.toLocaleTimeString()} - {last.timestamp.toLocaleTimeString()}
            </span>
            <span className="text-gray-400 truncate flex-1">
              {`session/update: ${chunkType}`}
            </span>
          </div>
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className={`ml-5 border-l-2 ${chunkStyle.borderClass} space-y-0.5 py-1`}>
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
