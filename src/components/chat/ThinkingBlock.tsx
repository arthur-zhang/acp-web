import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronRight, Brain } from 'lucide-react'

interface ThinkingBlockProps {
  content: string
  defaultOpen?: boolean
}

export function ThinkingBlock({ content, defaultOpen = false }: ThinkingBlockProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300
          py-1.5 px-2 rounded hover:bg-gray-800/50 transition-colors w-full text-left">
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-purple-400 font-medium">Thinking</span>
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="pl-8 pr-2 pb-2 text-sm text-gray-400 italic leading-relaxed
          border-l-2 border-purple-500/30 ml-2 whitespace-pre-wrap">
          {content}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
