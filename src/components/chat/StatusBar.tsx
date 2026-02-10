import { Loader2 } from 'lucide-react'
import type { AgentState, ConnectionStatus } from '../../types'

interface StatusBarProps {
  agentState: AgentState
  connectionStatus: ConnectionStatus
  sessionId: string | null
}

const stateLabels: Record<AgentState, string> = {
  idle: 'Ready',
  thinking: 'Thinking...',
  tool_calling: 'Running tools...',
  responding: 'Writing...',
}

export function StatusBar({ agentState, connectionStatus, sessionId }: StatusBarProps) {
  const isActive = agentState !== 'idle'

  return (
    <div className="flex items-center justify-between px-4 py-1.5
      border-t border-gray-800 bg-gray-950/80 text-xs text-gray-500">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 font-medium">Opus 4.6</span>
        {connectionStatus !== 'connected' && (
          <span className="text-yellow-500">({connectionStatus})</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {isActive && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
        <span className={isActive ? 'text-blue-400' : ''}>
          {sessionId ? stateLabels[agentState] : 'No session'}
        </span>
      </div>
    </div>
  )
}
