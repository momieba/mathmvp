import type { Difficulty } from '@/features/content/enums'

const ORDER: Difficulty[] = ['leicht', 'mittel', 'schwer', 'sehr_schwer']

/** Difficulty that fits the current score: start easy, get harder as mastery grows. */
export function targetDifficulty(score: number): Difficulty {
  if (score < 40) return 'leicht'
  if (score < 75) return 'mittel'
  return 'schwer'
}

export type Candidate = { id: string; difficulty: Difficulty }

/**
 * Picks the next exercise: avoids the most recently seen ones (if possible) and prefers the
 * target difficulty, falling back to the nearest available difficulty.
 */
export function selectExercise<T extends Candidate>(
  candidates: readonly T[],
  opts: { score: number; recentIds: readonly string[]; random?: () => number },
): T | null {
  if (candidates.length === 0) return null
  const random = opts.random ?? Math.random
  const recent = new Set(opts.recentIds.slice(0, Math.min(5, candidates.length - 1)))
  const fresh = candidates.filter((c) => !recent.has(c.id))
  const pool = fresh.length > 0 ? fresh : [...candidates]

  const target = ORDER.indexOf(targetDifficulty(opts.score))
  const distance = (c: T) => Math.abs(ORDER.indexOf(c.difficulty) - target)
  const best = Math.min(...pool.map(distance))
  const matching = pool.filter((c) => distance(c) === best)
  return matching[Math.floor(random() * matching.length)] ?? null
}
