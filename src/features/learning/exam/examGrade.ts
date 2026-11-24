// Grade of an exam from the share of points. Usual German key for tests (Klassenarbeit-like);
// from class 11 the 0–15 point scale of the Oberstufe is shown as well.

export type Grade = 1 | 2 | 3 | 4 | 5 | 6

/** Lower bounds in percent for grades 1–5; below the last one: 6. */
const GRADE_BOUNDS = [92, 81, 67, 50, 30] as const

export const gradeLabels: Record<Grade, string> = {
  1: 'sehr gut',
  2: 'gut',
  3: 'befriedigend',
  4: 'ausreichend',
  5: 'mangelhaft',
  6: 'ungenügend',
}

/** Lower bounds in percent for 15 … 1 points; below the last one: 0. */
const POINT_BOUNDS = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 33, 27, 20] as const

export function percentOf(points: number, maxPoints: number) {
  return maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0
}

export function gradeFor(percent: number): Grade {
  const i = GRADE_BOUNDS.findIndex((bound) => percent >= bound)
  return (i === -1 ? 6 : i + 1) as Grade
}

export function oberstufePointsFor(percent: number): number {
  const i = POINT_BOUNDS.findIndex((bound) => percent >= bound)
  return i === -1 ? 0 : 15 - i
}

export const EXAM_MINUTES = 30
export const EXAM_TASKS = 8
