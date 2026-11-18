import type { Exercise } from './schema'

/**
 * What the client may see to render the answer UI – never the solution itself.
 * Stored in exercises.presentation; the full answer goes to exercise_solutions.
 */
export function buildPresentation(exercise: Exercise): Record<string, unknown> {
  switch (exercise.type) {
    case 'numeric':
      return exercise.answer.unit ? { unit: exercise.answer.unit } : {}
    case 'multiple_choice':
      return { options: exercise.answer.options, multi: exercise.answer.correct.length > 1 }
    case 'true_false':
      return { statements: exercise.answer.statements.map((s) => s.text) }
    case 'matching':
      return { left: exercise.answer.left, right: exercise.answer.right }
    case 'cloze':
      return { gaps: exercise.answer.gaps.length }
    case 'ordering':
      // Deterministic shuffle by key so re-imports don't reshuffle; never the solved order.
      return { items: shuffleByKey(exercise.answer.items, exercise.key) }
    case 'term':
      return { variables: exercise.answer.variables }
    case 'handwritten':
      return {}
  }
}

function shuffleByKey<T>(items: readonly T[], key: string): T[] {
  let seed = [...key].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
  const random = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  // Make sure the presented order is not accidentally the solution.
  if (a.length > 1 && a.every((x, i) => x === items[i])) a.push(a.shift()!)
  return a
}
