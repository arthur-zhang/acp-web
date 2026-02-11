import type { ToolCall } from '../../types'

export function countAllToolCalls(tc: ToolCall): number {
  let count = 1
  if (tc.children?.length) {
    for (const child of tc.children) {
      count += countAllToolCalls(child)
    }
  }
  return count
}

export function countCompletedToolCalls(tc: ToolCall): number {
  let count = tc.status !== 'running' ? 1 : 0
  if (tc.children?.length) {
    for (const child of tc.children) {
      count += countCompletedToolCalls(child)
    }
  }
  return count
}

export function countSubagentToolCalls(tc: ToolCall): number {
  let count = tc.toolName === 'Task' ? 1 : 0
  if (tc.children?.length) {
    for (const child of tc.children) {
      count += countSubagentToolCalls(child)
    }
  }
  return count
}
