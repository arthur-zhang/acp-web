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
    <div className="border border-purple-500/20 bg-purple-500/5 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border-b border-purple-500/20">
        <MessageCircleQuestion className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-purple-300">Question</span>
      </div>

      {/* Questions */}
      <div className="px-3 py-3 space-y-4">
        {questions.map((q, qIdx) => {
          const selected = resolved
            ? resolvedAnswers?.[q.question]?.split(', ') || []
            : selections[qIdx] || []

          return (
            <div key={qIdx} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded">
                  {q.header}
                </span>
                {q.multiSelect && (
                  <span className="text-xs text-gray-500">Multiple</span>
                )}
              </div>
              <p className="text-sm text-gray-200">{q.question}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.options.map(opt => {
                  const isSelected = selected.includes(opt.label)
                  return (
                    <button
                      key={opt.label}
                      disabled={resolved}
                      onClick={() => handleSelect(qIdx, opt.label, q.multiSelect)}
                      className={`text-left px-3 py-2 rounded-md border text-xs transition-colors
                        ${isSelected
                          ? 'border-purple-500/50 bg-purple-600/20 text-purple-200'
                          : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'}
                        ${resolved ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0
                          ${isSelected ? 'border-purple-500 bg-purple-600' : 'border-gray-600'}`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <div className="font-medium text-gray-200">{opt.label}</div>
                          <div className="text-gray-500 mt-0.5">{opt.description}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Submit */}
      {!resolved && (
        <div className="px-3 py-2 border-t border-purple-500/10 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-md border transition-colors
              ${allAnswered
                ? 'border-purple-500/50 bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 cursor-pointer'
                : 'border-gray-700 bg-gray-800/30 text-gray-600 cursor-not-allowed'}`}
          >
            <Send className="w-3.5 h-3.5" />
            Submit
          </button>
        </div>
      )}

      {resolved && (
        <div className="px-3 py-2 border-t border-purple-500/10">
          <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
            <Check className="w-3.5 h-3.5" />
            Submitted
          </span>
        </div>
      )}
    </div>
  )
}
