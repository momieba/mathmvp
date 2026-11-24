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

/** Mistakes to underline in the drawing/photo: incorrect steps that came with a box. */
export function marksOf(steps: readonly GradedStep[]): Mark[] {
  return steps.flatMap((s, i) =>
    s.verdict === 'incorrect' && s.box ? [{ box: s.box, label: i + 1 }] : [],
  )
}
