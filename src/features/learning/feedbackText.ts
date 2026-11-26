import type { GradedStep, SubmitResult } from './api'
import type { Mark } from './HandwritingCanvas'

function formatNumber(n: number) {
  return String(n).replace('.', ',')
}

export function correctAnswerText(answer: SubmitResult['answer']) {
  return answer.value !== undefined
    ? `${formatNumber(answer.value)}${answer.unit ? ` ${answer.unit}` : ''}`
    : answer.correct?.map((i) => answer.options?.[i]).join(', ')
}

/**
 * Marks in the drawing/photo: incorrect steps get an underline with their number, correct steps a
 * discreet check – each only if the grader sent a box.
 */
export function marksOf(steps: readonly GradedStep[]): Mark[] {
  return steps.flatMap((s, i): Mark[] => {
    if (!s.box) return []
    if (s.verdict === 'incorrect') return [{ box: s.box, label: i + 1, kind: 'wrong' }]
    if (s.verdict === 'correct') return [{ box: s.box, label: i + 1, kind: 'correct' }]
    return []
  })
}
