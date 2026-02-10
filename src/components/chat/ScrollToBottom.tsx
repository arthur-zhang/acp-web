import { ArrowDown } from 'lucide-react'

interface ScrollToBottomProps {
  visible: boolean
  onClick: () => void
}

export function ScrollToBottom({ visible, onClick }: ScrollToBottomProps) {
  if (!visible) return null

  return (
    <button
      onClick={onClick}
      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10
        bg-gray-700 hover:bg-gray-600 text-gray-300
        rounded-full p-2 shadow-lg shadow-black/30
        transition-all duration-200 hover:scale-105"
      aria-label="Scroll to bottom"
    >
      <ArrowDown className="w-4 h-4" />
    </button>
  )
}
