import { Shield, ShieldCheck, ShieldX, Terminal } from 'lucide-react'
import type { PermissionRequest } from '../../types'

interface PermissionBlockProps {
  permissionRequest: PermissionRequest
  onRespond: (optionId: string) => void
}

function getButtonStyle(kind: string) {
  switch (kind) {
    case 'allow_always':
      return 'bg-green-600/20 border-green-500/30 text-green-300 hover:bg-green-600/30'
    case 'allow_once':
      return 'bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30'
    case 'reject_once':
    case 'reject_always':
      return 'bg-red-600/20 border-red-500/30 text-red-300 hover:bg-red-600/30'
    default:
      return 'bg-gray-600/20 border-gray-500/30 text-gray-300 hover:bg-gray-600/30'
  }
}

function getButtonIcon(kind: string) {
  switch (kind) {
    case 'allow_always':
    case 'allow_once':
      return <ShieldCheck className="w-3.5 h-3.5" />
    case 'reject_once':
    case 'reject_always':
      return <ShieldX className="w-3.5 h-3.5" />
    default:
      return <Shield className="w-3.5 h-3.5" />
  }
}

function getSelectedStyle(kind: string) {
  switch (kind) {
    case 'allow_always':
    case 'allow_once':
      return 'bg-green-600/30 border-green-500/50 text-green-300'
    case 'reject_once':
    case 'reject_always':
      return 'bg-red-600/30 border-red-500/50 text-red-300'
    default:
      return 'bg-gray-600/30 border-gray-500/50 text-gray-300'
  }
}

export function PermissionBlock({ permissionRequest, onRespond }: PermissionBlockProps) {
  const { options, toolCall, resolved, selectedOptionId } = permissionRequest

  const rawInput = toolCall.rawInput
  const description = rawInput?.description as string | undefined
  const command = rawInput?.command as string | undefined

  return (
    <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
        <Shield className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-medium text-yellow-300">Permission Required</span>
      </div>

      {/* Tool call info */}
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Terminal className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <code className="text-xs bg-gray-800 px-2 py-0.5 rounded font-mono truncate">
            {toolCall.title}
          </code>
        </div>
        {description && (
          <p className="text-xs text-gray-400 pl-5.5">{description}</p>
        )}
        {command && command !== toolCall.title && (
          <pre className="text-xs text-gray-400 bg-gray-900/50 rounded p-2 overflow-x-auto font-mono">
            {command}
          </pre>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-3 py-2 flex flex-wrap gap-2 border-t border-yellow-500/10">
        {resolved ? (
          options.map(opt => {
            const isSelected = opt.optionId === selectedOptionId
            if (!isSelected) return null
            const selectedKind = opt.kind
            return (
              <span
                key={opt.optionId}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border ${getSelectedStyle(selectedKind)}`}
              >
                {getButtonIcon(selectedKind)}
                {opt.name}
              </span>
            )
          })
        ) : (
          options.map(opt => (
            <button
              key={opt.optionId}
              onClick={() => onRespond(opt.optionId)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
                rounded-md border transition-colors cursor-pointer ${getButtonStyle(opt.kind)}`}
            >
              {getButtonIcon(opt.kind)}
              {opt.name}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
