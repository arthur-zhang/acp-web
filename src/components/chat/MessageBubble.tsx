import { MarkdownRenderer } from './MarkdownRenderer'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallBlock } from './ToolCallBlock'
import { PermissionBlock } from './PermissionBlock'
import type { ChatMessage } from '../../types'

interface MessageBubbleProps {
  message: ChatMessage
  onRespondPermission?: (messageId: string, optionId: string) => void
}

export function MessageBubble({ message, onRespondPermission }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-blue-600/20 border border-blue-500/20
          rounded-2xl rounded-br-sm px-4 py-2.5">
          <p className="text-sm text-gray-100 whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    )
  }

  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  if (message.role === 'thought') {
    return <ThinkingBlock content={message.content} />
  }

  if (message.role === 'tool_call_group' && message.toolCalls) {
    return <ToolCallBlock toolCalls={message.toolCalls} />
  }

  if (message.role === 'permission_request' && message.permissionRequest) {
    return (
      <PermissionBlock
        permissionRequest={message.permissionRequest}
        onRespond={(optionId) => onRespondPermission?.(message.id, optionId)}
      />
    )
  }

  // Assistant message with markdown
  return (
    <div className="max-w-[95%]">
      <MarkdownRenderer content={message.content} />
    </div>
  )
}
