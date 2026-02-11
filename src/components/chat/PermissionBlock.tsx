import { useState } from 'react'
import { Shield, ShieldCheck, ShieldX, ChevronDown, AlertTriangle, Terminal } from 'lucide-react'
import type { PermissionRequest } from '../../types'

interface PermissionBlockProps {
  permissionRequest: PermissionRequest
  onRespond: (optionId: string) => void
}

function getButtonStyle(kind: string) {
  switch (kind) {
    case 'allow_always':
      return 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 active:bg-emerald-500/30'
    case 'allow_once':
      return 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 active:bg-blue-500/30'
    case 'reject_once':
    case 'reject_always':
      return 'bg-red-500/10 text-red-400 hover:bg-red-500/20 active:bg-red-500/30'
    default:
      return 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
    case 'reject_once':
    case 'reject_always':
      return 'bg-red-500/15 border-red-500/30 text-red-300'
    default:
      return 'bg-gray-800 border-gray-700 text-gray-300'
  }
}

function normalizeCommandText(value?: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 1) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

function truncateText(value: string, maxLength = 110): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function isDangerousCommand(command?: string): boolean {
  if (!command) return false
  return /(\brm\b|\bdel\b|\bsudo\b|\bchmod\b|\bchown\b|\bdd\b|\bmkfs\b)/i.test(command)
}

export function PermissionBlock({ permissionRequest, onRespond }: PermissionBlockProps) {
  const { options, toolCall, resolved, selectedOptionId } = permissionRequest
  const [expanded, setExpanded] = useState(false)

  if (resolved) {
    const selectedOption = options.find(opt => opt.optionId === selectedOptionId)
    const fallbackLabel = selectedOptionId === 'cancelled' ? 'Cancelled' : 'Responded'
    const selectedLabel = selectedOption?.name ?? fallbackLabel
    const selectedKind = selectedOption?.kind ?? 'unknown'

    return (
      <div className="flex justify-end my-1">
        <div
          className={`rounded-xl border px-3 py-1.5 shadow-sm flex items-center gap-2 text-xs font-medium ${getSelectedStyle(selectedKind)}`}
        >
          {getButtonIcon(selectedKind)}
          {selectedLabel}
        </div>
      </div>
    )
  }

  const rawInput = toolCall.rawInput
  const description = typeof rawInput?.description === 'string' ? rawInput.description : undefined
  const commandFromRaw = normalizeCommandText(typeof rawInput?.command === 'string' ? rawInput.command : undefined)
  const normalizedTitle = normalizeCommandText(toolCall.title)
  const command = commandFromRaw ?? normalizedTitle
  const title = normalizedTitle && normalizedTitle !== command ? normalizedTitle : undefined
  const canExpand = Boolean((command && command.length > 110) || (title && title.length > 110))
  const dangerousCommand = isDangerousCommand(command)

  return (
    <div className="my-2 max-w-2xl rounded-xl border border-gray-800 bg-gray-900/40 p-3 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-bold text-gray-200">Permission Required</span>
          {dangerousCommand && (
            <span className="flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
              <AlertTriangle className="h-2.5 w-2.5" />
              SENSITIVE
            </span>
          )}
        </div>
        {canExpand && (
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {description && (
          <p className="text-xs text-gray-400 leading-relaxed px-1">
            {description}
          </p>
        )}

        {(command || title) && (
          <div className="flex items-start gap-2.5 rounded-lg bg-black/30 p-2.5 font-mono text-[12px] border border-white/5">
            <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
            <div className="min-w-0 flex-1">
              <code className={`block text-gray-200 ${expanded ? 'break-all whitespace-pre-wrap' : 'truncate'}`}>
                {expanded ? command : truncateText(command || '', 140)}
              </code>
              {expanded && title && title !== command && (
                <div className="mt-2 pt-2 border-t border-white/5 text-gray-400">
                  <span className="text-[10px] font-bold text-gray-600 block mb-0.5">TITLE</span>
                  {title}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {options.map(opt => (
            <button
              key={opt.optionId}
              onClick={() => onRespond(opt.optionId)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold transition-all ${getButtonStyle(opt.kind)}`}
            >
              {getButtonIcon(opt.kind)}
              {opt.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
