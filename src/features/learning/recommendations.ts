/**
 * Review suggestions based on the subtopic scores (stage 1 of the skill plan,
 * docs/specs/2026-11-25-skill-modell-und-wiederholung.md). Assumptions – tune here:
 * - a subtopic is "shaky" with < 40 points after at least 6 attempts, or after 3 wrong answers
 *   in a row in the current session;
 * - a prerequisite is weak with < 50 points after at least 3 attempts, or if never practised;
 * - a shaky subtopic with a weak prerequisite → repeat the weakest prerequisite first,
 *   otherwise → watch the video again (if published) / repeat the basics.
 */
export const SHAKY_SCORE = 40
export const SHAKY_MIN_ATTEMPTS = 6
export const SHAKY_WRONG_STREAK = 3
export const WEAK_PREREQUISITE_SCORE = 50
export const WEAK_PREREQUISITE_MIN_ATTEMPTS = 3

type Progress = { score: number; attemptCount: number }
export type SubtopicRef = { id: string; slug: string; title: string }
export type VideoRef = { title: string; url: string }

export type Recommendation =
  | { kind: 'prerequisite'; subtopic: SubtopicRef; video: VideoRef | null }
  | { kind: 'review'; video: VideoRef | null }

export function isShaky(progress: Progress | undefined, sessionWrongStreak = 0): boolean {
  if (sessionWrongStreak >= SHAKY_WRONG_STREAK) return true
  return !!progress && progress.attemptCount >= SHAKY_MIN_ATTEMPTS && progress.score < SHAKY_SCORE
}

function isWeakPrerequisite(progress: Progress | undefined): boolean {
  if (!progress || progress.attemptCount === 0) return true
  return (
    progress.attemptCount >= WEAK_PREREQUISITE_MIN_ATTEMPTS &&
    progress.score < WEAK_PREREQUISITE_SCORE
  )
}

/** The single strongest suggestion for a subtopic, or null if it is going fine. */
export function recommend(args: {
  subtopicId: string
  progress: ReadonlyMap<string, Progress> | undefined
  prerequisites: readonly SubtopicRef[]
  videos: ReadonlyMap<string, readonly VideoRef[]> | undefined
  sessionWrongStreak?: number
}): Recommendation | null {
  const { subtopicId, progress, prerequisites, videos } = args
  if (!isShaky(progress?.get(subtopicId), args.sessionWrongStreak)) return null

  const weak = prerequisites
    .filter((p) => isWeakPrerequisite(progress?.get(p.id)))
    .map((p) => ({ p, score: progress?.get(p.id)?.score ?? 0 }))
    .sort((a, b) => a.score - b.score)[0]
  if (weak) {
    return { kind: 'prerequisite', subtopic: weak.p, video: videos?.get(weak.p.id)?.[0] ?? null }
  }
  return { kind: 'review', video: videos?.get(subtopicId)?.[0] ?? null }
}

/** Length of the trailing run of wrong answers (oldest first). */
export function wrongStreak(results: readonly boolean[]): number {
  let n = 0
  for (let i = results.length - 1; i >= 0 && !results[i]; i--) n++
  return n
}
