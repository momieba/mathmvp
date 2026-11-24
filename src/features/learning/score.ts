/**
 * Mastery score per subtopic (0–100), replayed from the last 15 attempts starting at 0:
 * - correct: + a quarter of the distance to 100 (at least +3) → diminishing gains
 * - wrong:   −8, but only while above 70 points
 * - 10 correct in a row → 100
 */
export const SCORE_WINDOW = 15
export const STREAK_FOR_FULL_SCORE = 10
const GAIN_FACTOR = 0.25
const MIN_GAIN = 3
const PENALTY = 8
const PENALTY_THRESHOLD = 70

/** `attempts` in chronological order (oldest first); only the last 15 count. */
export function computeScore(attempts: readonly { correct: boolean }[]): number {
  let score = 0
  let streak = 0
  for (const { correct } of attempts.slice(-SCORE_WINDOW)) {
    if (correct) {
      streak++
      score = Math.min(100, score + Math.max(MIN_GAIN, Math.round((100 - score) * GAIN_FACTOR)))
      if (streak >= STREAK_FOR_FULL_SCORE) score = 100
    } else {
      streak = 0
      if (score > PENALTY_THRESHOLD) score = Math.max(0, score - PENALTY)
    }
  }
  return score
}

export type MasteryLevel = 'neu' | 'anfang' | 'ueben' | 'sicher' | 'gemeistert'

export function masteryLevel(score: number, attemptCount: number): MasteryLevel {
  if (attemptCount === 0) return 'neu'
  if (score >= 100) return 'gemeistert'
  if (score >= 70) return 'sicher'
  if (score >= 40) return 'ueben'
  return 'anfang'
}

export const masteryLabels: Record<MasteryLevel, string> = {
  neu: 'Neu',
  anfang: 'Am Anfang',
  ueben: 'Am Üben',
  sicher: 'Sicher',
  gemeistert: 'Gemeistert',
}

/** Topic progress: average score over all its subtopics (untouched ones count as 0). */
export function topicProgress(
  subtopicIds: readonly string[],
  progress: ReadonlyMap<string, { score: number; attemptCount: number }> | undefined,
) {
  if (subtopicIds.length === 0) return { score: 0, attemptCount: 0, started: 0 }
  let sum = 0
  let attemptCount = 0
  let started = 0
  for (const id of subtopicIds) {
    const p = progress?.get(id)
    sum += p?.score ?? 0
    attemptCount += p?.attemptCount ?? 0
    if (p && p.attemptCount > 0) started++
  }
  return { score: Math.round(sum / subtopicIds.length), attemptCount, started }
}
