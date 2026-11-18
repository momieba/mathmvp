import { computeScore, masteryLevel } from './score'

const run = (pattern: string) => [...pattern].map((c) => ({ correct: c === 'r' }))

describe('computeScore', () => {
  it('starts at 0', () => {
    expect(computeScore([])).toBe(0)
  })

  it('adds less the higher the score is', () => {
    expect([1, 2, 3, 4, 5].map((n) => computeScore(run('r'.repeat(n))))).toEqual([
      25, 44, 58, 69, 77,
    ])
  })

  it('does not deduct points at or below 70', () => {
    expect(computeScore(run('rrrr' + 'f'))).toBe(69)
    expect(computeScore(run('ff'))).toBe(0)
  })

  it('deducts a few points above 70', () => {
    expect(computeScore(run('rrrrr' + 'f'))).toBe(77 - 8)
  })

  it('gives 100 for 10 correct in a row', () => {
    expect(computeScore(run('r'.repeat(9)))).toBeLessThan(100)
    expect(computeScore(run('r'.repeat(10)))).toBe(100)
    expect(computeScore(run('ff' + 'r'.repeat(10)))).toBe(100)
  })

  it('only counts the last 15 attempts', () => {
    // 10 wrong answers long ago do not matter once 15 newer attempts exist
    expect(computeScore(run('f'.repeat(10) + 'r'.repeat(15)))).toBe(100)
    // a streak interrupted inside the window is not 10 in a row
    expect(computeScore(run('rrrrrrfrrrr'))).toBeLessThan(100)
  })

  it('never leaves 0..100', () => {
    for (const p of ['r'.repeat(40), 'rf'.repeat(20), 'f'.repeat(20)]) {
      const s = computeScore(run(p))
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })
})

describe('masteryLevel', () => {
  it('maps scores to levels', () => {
    expect(masteryLevel(0, 0)).toBe('neu')
    expect(masteryLevel(0, 3)).toBe('anfang')
    expect(masteryLevel(55, 5)).toBe('ueben')
    expect(masteryLevel(80, 8)).toBe('sicher')
    expect(masteryLevel(100, 10)).toBe('gemeistert')
  })
})
