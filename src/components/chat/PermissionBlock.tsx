import { useState } from 'react'
import { Shield, ShieldCheck, ShieldX, ChevronDown, AlertTriangle } from 'lucide-react'
import type { PermissionRequest } from '../../types'

interface PermissionBlockProps {
  permissionRequest: PermissionRequest
  onRespond: (optionId: string) => void
}

function getButtonStyle(kind: string) {
  switch (kind) {
    case 'allow_always':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-400/45'
    case 'allow_once':
      return 'border-blue-500/35 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 hover:border-blue-400/45'
    case 'reject_once':
    case 'reject_always':
      return 'border-red-500/35 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:border-red-400/45'
    default:
      return 'border-gray-700/80 bg-gray-800/40 text-gray-200 hover:bg-gray-800/70'
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
      return 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
    case 'reject_once':
    case 'reject_always':
      return 'bg-red-500/15 border-red-500/35 text-red-200'
    default:
      return 'bg-gray-800/60 border-gray-700/80 text-gray-200'
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
      <div className="flex justify-end">
        <div
          className={`max-w-[80%] rounded-2xl rounded-br-sm border px-3 py-2 shadow-sm ${getSelectedStyle(selectedKind)}`}
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            {getButtonIcon(selectedKind)}
            {selectedLabel}
          </span>
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
    <div className="rounded-xl border border-gray-800/80 bg-gradient-to-b from-gray-900/70 to-gray-950/55 px-3.5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-100">
          <Shield className="h-4 w-4 text-amber-400" />
          Permission Required
        </span>

        {dangerousCommand && (
          <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-200">
            <AlertTriangle className="h-3 w-3" />
            Sensitive
          </span>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          {options.map(opt => (
            <button
              key={opt.optionId}
              onClick={() => onRespond(opt.optionId)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5
                text-xs font-semibold transition-colors ${getButtonStyle(opt.kind)}`}
            >
              {getButtonIcon(opt.kind)}
              {opt.name}
            </button>
          ))}
        </div>
      </div>

      {(description || command || title) && (
        <div className="mt-3 rounded-lg border border-gray-800/80 bg-gray-950/45 px-2.5 py-2">
          {description && (
            <p className="mb-2 text-xs leading-relaxed text-gray-300">
              {description}
            </p>
          )}

          {command && (
            <div className="flex items-start gap-2">
              <span className="mt-1.5 inline-flex w-9 flex-shrink-0 justify-center text-[10px] font-medium uppercase tracking-wide text-gray-500">
                CMD
              </span>
              <span className="mt-1.5 text-gray-600">›</span>
              <code
                className={`min-w-0 flex-1 rounded-md border border-gray-800/80 bg-gray-900/60 px-2.5 py-1.5 text-[12px] text-gray-100 font-mono ${
                  expanded ? 'break-all whitespace-pre-wrap' : 'truncate'
                }`}
              >
                {expanded ? command : truncateText(command, 140)}
              </code>

              {canExpand && (
                <button
                  onClick={() => setExpanded(prev => !prev)}
                  className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-800/70 hover:text-gray-200 transition-colors"
                  type="button"
                  title={expanded ? 'Collapse' : 'Expand'}
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}

          {expanded && title && (
            <div className="mt-2 flex items-start gap-2">
              <span className="mt-1.5 inline-flex w-9 flex-shrink-0 justify-center text-[10px] font-medium uppercase tracking-wide text-gray-500">
                TITLE
              </span>
              <span className="mt-1.5 text-gray-600">›</span>
              <code className="min-w-0 flex-1 break-all whitespace-pre-wrap rounded-md border border-gray-800/80 bg-gray-900/60 px-2.5 py-1.5 text-[12px] text-gray-300 font-mono">
                {title}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
