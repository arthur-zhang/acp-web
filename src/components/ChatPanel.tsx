import { useState, useEffect, useRef, useCallback, KeyboardEvent, useMemo } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { ArrowUp, Square } from 'lucide-react'
import { MessageBubble } from './chat/MessageBubble'
import { InteractionGroup } from './chat/InteractionGroup'
import { ScrollToBottom } from './chat/ScrollToBottom'
import { StatusBar } from './chat/StatusBar'
import type { ConnectionStatus, ChatMessage, AgentState } from '../types'

interface ChatPanelProps {
  status: ConnectionStatus
  sessionId: string | null
  messages: ChatMessage[]
  agentState: AgentState
  onSendPrompt: (text: string) => void
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
  onSendPrompt,
  onRespondPermission,
  onRespondAskUserQuestion,
  onInterrupt,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isActive = agentState !== 'idle'
  const viewportRef = useRef<HTMLDivElement>(null)

  const displayItems = useMemo(() => buildDisplayItems(messages), [messages])

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isActive) {
        onInterrupt()
      } else {
        handleSend()
      }
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
        <div className="relative max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sessionId
              ? 'Ask, make changes, @mention files, run /commands'
              : 'Connecting...'}
            rows={1}
            disabled={!sessionId}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12
              resize-none text-sm focus:outline-none focus:border-gray-500 focus:ring-1
              focus:ring-gray-500/50 placeholder:text-gray-500
              disabled:opacity-50 transition-colors"
          />
          <button
            onClick={isActive ? onInterrupt : handleSend}
            disabled={!sessionId || (!isActive && !input.trim())}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg
              transition-colors ${
                isActive
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500'
              }`}
          >
            {isActive
              ? <Square className="w-4 h-4 fill-current" />
              : <ArrowUp className="w-4 h-4" />
            }
          </button>
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
