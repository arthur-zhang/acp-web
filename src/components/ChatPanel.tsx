import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { ArrowUp } from 'lucide-react'
import { MessageBubble } from './chat/MessageBubble'
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
}

export function ChatPanel({
  status,
  sessionId,
  messages,
  agentState,
  onSendPrompt,
  onRespondPermission,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const viewportRef = useRef<HTMLDivElement>(null)

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
    if (!input.trim() || !sessionId) return
    onSendPrompt(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onRespondPermission={onRespondPermission}
                />
              ))}
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
            onClick={handleSend}
            disabled={!sessionId || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg
              bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500
              transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
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
