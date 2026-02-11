import { useState } from 'react'
import { MessageCircleQuestion, Check, Send } from 'lucide-react'
import type { PermissionRequest, AskUserQuestion } from '../../types'

interface AskUserQuestionBlockProps {
  permissionRequest: PermissionRequest
  onSubmit: (answers: Record<string, string>) => void
}

/** Extract questions array from rawInput */
function getQuestions(rawInput?: Record<string, unknown>): AskUserQuestion[] | null {
  if (!rawInput?.questions || !Array.isArray(rawInput.questions)) return null
  return rawInput.questions as AskUserQuestion[]
}

export function AskUserQuestionBlock({ permissionRequest, onSubmit }: AskUserQuestionBlockProps) {
  const { toolCall, resolved, answers: resolvedAnswers } = permissionRequest
  const questions = getQuestions(toolCall.rawInput)

  // selections: key = question index, value = selected label(s)
  const [selections, setSelections] = useState<Record<number, string[]>>({})

  if (!questions || questions.length === 0) return null

  const handleSelect = (qIdx: number, label: string, multiSelect: boolean) => {
    if (resolved) return
    setSelections(prev => {
      const current = prev[qIdx] || []
      if (multiSelect) {
        const next = current.includes(label)
          ? current.filter(l => l !== label)
          : [...current, label]
        return { ...prev, [qIdx]: next }
      }
      return { ...prev, [qIdx]: [label] }
    })
  }

  const allAnswered = questions.every((_, i) => (selections[i]?.length ?? 0) > 0)

  const handleSubmit = () => {
    if (!allAnswered || resolved) return
    const answers: Record<string, string> = {}
    questions.forEach((q, i) => {
      answers[q.question] = (selections[i] || []).join(', ')
    })
    onSubmit(answers)
  }

  return (
    <div className="my-2 max-w-2xl rounded-xl border border-purple-500/30 bg-purple-500/[0.03] p-3 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircleQuestion className="h-4 w-4 text-purple-400" />
        <span className="text-xs font-bold text-purple-200">User Input Required</span>
      </div>

      <div className="space-y-5">
        {questions.map((q, qIdx) => {
          const selected = resolved
            ? resolvedAnswers?.[q.question]?.split(', ') || []
            : selections[qIdx] || []

          return (
            <div key={qIdx} className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 uppercase tracking-tight">
                  {q.header}
                </span>
                {q.multiSelect && (
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Multiple</span>
                )}
              </div>
              <p className="text-[13px] font-medium text-gray-200 leading-relaxed px-1">{q.question}</p>
              <div className="grid grid-cols-1 gap-2">
                {q.options.map(opt => {
                  const isSelected = selected.includes(opt.label)
                  return (
                    <button
                      key={opt.label}
                      disabled={resolved}
                      onClick={() => handleSelect(qIdx, opt.label, q.multiSelect)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-all
                        ${isSelected
                          ? 'border-purple-500/40 bg-purple-500/10 text-purple-100'
                          : 'border-gray-800 bg-gray-900/40 text-gray-400 hover:border-gray-700 hover:text-gray-300'}
                        ${resolved ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                          ${isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-700'}`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`font-bold ${isSelected ? 'text-purple-100' : 'text-gray-300'}`}>{opt.label}</div>
                          {opt.description && (
                            <div className="text-gray-500 mt-0.5 text-[11px] truncate">{opt.description}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="flex items-center justify-end pt-1">
          {!resolved ? (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered}
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-md border transition-all
                ${allAnswered
                  ? 'border-purple-500/30 bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 active:scale-95'
                  : 'border-gray-800 bg-gray-900/50 text-gray-600 cursor-not-allowed'}`}
            >
              <Send className="w-3.5 h-3.5" />
              Submit
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Submitted</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
