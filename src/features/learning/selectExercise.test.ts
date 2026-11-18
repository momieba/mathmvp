import { selectExercise, targetDifficulty } from './selectExercise'

const ex = (id: string, difficulty: 'leicht' | 'mittel' | 'schwer') => ({ id, difficulty })
const pool = [ex('l1', 'leicht'), ex('l2', 'leicht'), ex('m1', 'mittel'), ex('s1', 'schwer')]

describe('targetDifficulty', () => {
  it('gets harder with the score', () => {
    expect([0, 39, 40, 74, 75, 100].map(targetDifficulty)).toEqual([
      'leicht',
      'leicht',
      'mittel',
      'mittel',
      'schwer',
      'schwer',
    ])
  })
})

describe('selectExercise', () => {
  it('returns null without candidates', () => {
    expect(selectExercise([], { score: 0, recentIds: [] })).toBeNull()
  })

  it('prefers the target difficulty', () => {
    expect(selectExercise(pool, { score: 50, recentIds: [] })?.id).toBe('m1')
    expect(selectExercise(pool, { score: 90, recentIds: [] })?.id).toBe('s1')
  })

  it('avoids recently seen exercises', () => {
    expect(selectExercise(pool, { score: 0, recentIds: ['l1'], random: () => 0 })?.id).toBe('l2')
  })

  it('falls back to the nearest difficulty when the target is exhausted', () => {
    expect(selectExercise(pool, { score: 50, recentIds: ['m1'] })?.difficulty).not.toBe('mittel')
  })

  it('still returns something when everything was seen recently', () => {
    const single = [ex('only', 'leicht')]
    expect(selectExercise(single, { score: 0, recentIds: ['only'] })?.id).toBe('only')
  })
})
