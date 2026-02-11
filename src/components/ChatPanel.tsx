import { useState, useEffect, useRef, useCallback, KeyboardEvent, useMemo } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ArrowUp, Square, ChevronDown, Check, Plus } from 'lucide-react'
import { MessageBubble } from './chat/MessageBubble'
import { InteractionGroup } from './chat/InteractionGroup'
import { ScrollToBottom } from './chat/ScrollToBottom'
import { StatusBar } from './chat/StatusBar'
import type { ConnectionStatus, ChatMessage, AgentState, ModeOption, ModelOption } from '../types'

interface ChatPanelProps {
  status: ConnectionStatus
  sessionId: string | null
  messages: ChatMessage[]
  agentState: AgentState
  modeOptions: ModeOption[]
  selectedModeId: string
  modelOptions: ModelOption[]
  selectedModelId: string
  onSendPrompt: (text: string) => void
  onSelectMode: (modeId: string) => void
  onSelectModel: (modelId: string) => void
  onRespondPermission: (messageId: string, optionId: string) => void
  onRespondAskUserQuestion: (messageId: string, answers: Record<string, string>) => void
  onInterrupt: () => void
}

type DisplayItem =
  | { type: 'single'; message: ChatMessage }
  | {
      type: 'round'
      id: string
      prompt: ChatMessage
      middleMessages: ChatMessage[]
      resultMessage?: ChatMessage
      isComplete: boolean
    }

function buildDisplayItems(messages: ChatMessage[]): DisplayItem[] {
  const items: DisplayItem[] = []

  let activeRound:
    | {
        prompt: ChatMessage
        responses: ChatMessage[]
      }
    | null = null

  const flushRound = () => {
    if (!activeRound) return

    const { prompt, responses } = activeRound
    const lastMessage = responses[responses.length - 1]
    const hasFinalResult = lastMessage?.role === 'assistant'
    const resultMessage = hasFinalResult ? lastMessage : undefined
    const middleMessages = hasFinalResult ? responses.slice(0, -1) : responses

    items.push({
      type: 'round',
      id: prompt.id,
      prompt,
      middleMessages,
      resultMessage,
      isComplete: hasFinalResult,
    })

    activeRound = null
  }

  for (const message of messages) {
    if (message.role === 'user') {
      flushRound()
      activeRound = {
        prompt: message,
        responses: [],
      }
      continue
    }

    if (activeRound) {
      activeRound.responses.push(message)
      continue
    }

    items.push({ type: 'single', message })
  }

  flushRound()

  return items
}

export function ChatPanel({
  status,
  sessionId,
  messages,
  agentState,
  modeOptions,
  selectedModeId,
  modelOptions,
  selectedModelId,
  onSendPrompt,
  onSelectMode,
  onSelectModel,
  onRespondPermission,
  onRespondAskUserQuestion,
  onInterrupt,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [modelQuery, setModelQuery] = useState('')
  const isActive = agentState !== 'idle'
  const viewportRef = useRef<HTMLDivElement>(null)

  const displayItems = useMemo(() => buildDisplayItems(messages), [messages])

  const selectedModeLabel = useMemo(() => {
    return modeOptions.find(option => option.id === selectedModeId)?.name ?? selectedModeId
  }, [modeOptions, selectedModeId])

  const selectedModelLabel = useMemo(() => {
    return modelOptions.find(option => option.id === selectedModelId)?.name ?? selectedModelId
  }, [modelOptions, selectedModelId])

  const filteredModelOptions = useMemo(() => {
    const query = modelQuery.trim().toLowerCase()
    if (!query) return modelOptions

    return modelOptions.filter(option =>
      option.name.toLowerCase().includes(query) || option.id.toLowerCase().includes(query),
    )
  }, [modelQuery, modelOptions])

  const handleScroll = useCallback(() => {
    if (!viewportRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = viewportRef.current
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50)
  }, [])

  useEffect(() => {
    if (isAtBottom && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [messages, isAtBottom])

  const scrollToBottom = () => {
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }

  const handleSend = () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || !sessionId) return

    setInput('')
    onSendPrompt(trimmedInput)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isActive) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Messages area */}
      <div className="flex-1 relative overflow-hidden">
        <ScrollArea.Root className="h-full">
          <ScrollArea.Viewport
            ref={viewportRef}
            className="h-full w-full px-6 py-4"
            onScroll={handleScroll}
          >
            <div className="space-y-4 max-w-3xl mx-auto">
              {displayItems.map((item, index) => {
                if (item.type === 'single') {
                  return (
                    <MessageBubble
                      key={item.message.id}
                      message={item.message}
                      onRespondPermission={onRespondPermission}
                      onRespondAskUserQuestion={onRespondAskUserQuestion}
                    />
                  )
                }

                const shouldExpandGroup = index === displayItems.length - 1 && !item.isComplete

                return (
                  <div key={item.id} className="space-y-3">
                    <MessageBubble
                      message={item.prompt}
                      onRespondPermission={onRespondPermission}
                      onRespondAskUserQuestion={onRespondAskUserQuestion}
                    />

                    {item.middleMessages.length > 0 && (
                      <InteractionGroup
                        messages={item.middleMessages}
                        isLatest={shouldExpandGroup}
                        onRespondPermission={onRespondPermission}
                        onRespondAskUserQuestion={onRespondAskUserQuestion}
                      />
                    )}

                    {item.resultMessage && (
                      <MessageBubble
                        message={item.resultMessage}
                        onRespondPermission={onRespondPermission}
                        onRespondAskUserQuestion={onRespondAskUserQuestion}
                      />
                    )}
                  </div>
                )
              })}
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
        <ScrollToBottom visible={!isAtBottom} onClick={scrollToBottom} />
      </div>

      {/* Input area */}
      <div className="px-6 py-3">
        <div className="max-w-3xl mx-auto rounded-2xl border border-gray-800/80 bg-gray-900/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sessionId ? 'Add a follow up' : 'Connecting...'}
            rows={6}
            disabled={!sessionId}
            className="min-h-[160px] w-full bg-transparent rounded-t-2xl px-4 pt-4 pb-2 text-sm leading-6
              resize-none focus:outline-none placeholder:text-gray-500
              disabled:opacity-50 transition-colors"
          />

          <div className="flex items-center justify-between gap-2 px-3 pb-3">
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-800/80 bg-gray-900/20 text-gray-400
                  hover:bg-gray-800/30 transition-colors"
                title="Add context"
                type="button"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    disabled={!sessionId}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-800/80 bg-gray-900/20 px-2.5 py-1.5 text-sm
                      text-gray-200 hover:bg-gray-800/30 transition-colors disabled:opacity-50 disabled:hover:bg-gray-900/20"
                    title="Mode"
                    type="button"
                  >
                    <span className="text-[11px] uppercase tracking-wide text-gray-400">Mode</span>
                    <span className="max-w-[140px] truncate">{selectedModeLabel}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-[260px] rounded-xl border border-gray-800/80 bg-gray-900/95 p-1.5 shadow-xl"
                >
                  {modeOptions.map((option) => (
                    <DropdownMenu.Item
                      key={option.id}
                      onSelect={() => onSelectMode(option.id)}
                      className="flex items-start justify-between gap-3 rounded-md px-3 py-2 text-[14px] text-gray-200
                        cursor-pointer outline-none hover:bg-gray-800/40 data-[highlighted]:bg-gray-800/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate">{option.name}</div>
                        {option.description && (
                          <div className="mt-0.5 text-[12px] text-gray-400 leading-snug line-clamp-2">
                            {option.description}
                          </div>
                        )}
                      </div>
                      {option.id === selectedModeId && (
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-300" />
                      )}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Root>

              <DropdownMenu.Root
                open={modelMenuOpen}
                onOpenChange={(open) => {
                  setModelMenuOpen(open)
                  if (!open) setModelQuery('')
                }}
              >
                <DropdownMenu.Trigger asChild>
                  <button
                    disabled={!sessionId}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-800/80 bg-gray-900/20 px-2.5 py-1.5 text-sm
                      text-gray-200 hover:bg-gray-800/30 transition-colors disabled:opacity-50 disabled:hover:bg-gray-900/20"
                    title="Model"
                    type="button"
                  >
                    <span className="text-[11px] uppercase tracking-wide text-gray-400">Model</span>
                    <span className="max-w-[160px] truncate">{selectedModelLabel}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 w-[360px] rounded-xl border border-gray-800/80 bg-gray-900/95 shadow-xl"
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <div className="border-b border-gray-800/80 p-2">
                    <input
                      autoFocus
                      value={modelQuery}
                      onChange={(event) => setModelQuery(event.target.value)}
                      placeholder="Search models..."
                      className="w-full rounded-md border border-gray-800/80 bg-gray-950/40 px-2.5 py-2 text-sm text-gray-200
                        focus:outline-none focus:border-blue-500 placeholder:text-gray-500"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1.5">
                    {filteredModelOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">No models found</div>
                    ) : (
                      filteredModelOptions.map((option) => (
                        <DropdownMenu.Item
                          key={option.id}
                          onSelect={() => {
                            onSelectModel(option.id)
                            setModelMenuOpen(false)
                            setModelQuery('')
                          }}
                          className="flex items-start justify-between gap-3 rounded-md px-3 py-2 text-[14px] text-gray-200
                            cursor-pointer outline-none hover:bg-gray-800/40 data-[highlighted]:bg-gray-800/40"
                        >
                          <div className="min-w-0">
                            <div className="truncate">{option.name}</div>
                            <div className="mt-0.5 truncate text-[12px] text-gray-400 leading-snug">{option.id}</div>
                            {option.description && (
                              <div className="mt-0.5 text-[12px] text-gray-400 leading-snug line-clamp-2">
                                {option.description}
                              </div>
                            )}
                          </div>
                          {option.id === selectedModelId && (
                            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-300" />
                          )}
                        </DropdownMenu.Item>
                      ))
                    )}
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Root>

              <button
                onClick={isActive ? onInterrupt : handleSend}
                disabled={!sessionId || (!isActive && !input.trim())}
                title={isActive ? 'Interrupt' : 'Send'}
                type="button"
                className={`inline-flex items-center justify-center gap-2 h-9 rounded-lg border transition-colors ${
                  isActive
                    ? 'px-3 border-red-400/60 text-red-200 bg-red-500/10 hover:bg-red-500/20'
                    : 'w-9 border-gray-800/80 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 disabled:border-gray-800/80 disabled:text-gray-600 disabled:bg-transparent'
                }`}
              >
                {isActive ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span className="text-sm">Interrupt</span>
                  </>
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar
        agentState={agentState}
        connectionStatus={status}
        sessionId={sessionId}
      />
    </div>
  )
}
