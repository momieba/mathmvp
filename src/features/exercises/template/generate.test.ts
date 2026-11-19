import katex from 'katex'
import pilot from './examples/pythagoras-hypotenuse-berechnen.json'
import { generateExercises } from './generate'

const MATH = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g

describe('generateExercises – pilot template (Pythagoras, Hypotenuse)', () => {
  const exercises = generateExercises(pilot)

  it('produces 20 exercises with consecutive keys', () => {
    expect(exercises).toHaveLength(20)
    expect(exercises[0]!.key).toBe('pythagoras-hypotenuse-berechnen-001')
    expect(exercises[19]!.key).toBe('pythagoras-hypotenuse-berechnen-020')
  })

  it('follows the difficulty mix of the template levels', () => {
    const count = (d: string) => exercises.filter((e) => e.placements[0]!.difficulty === d).length
    expect([count('leicht'), count('mittel'), count('schwer')]).toEqual([10, 7, 3])
  })

  it('never repeats a prompt', () => {
    expect(new Set(exercises.map((e) => e.prompt)).size).toBe(exercises.length)
  })

  it('never repeats the same numbers within a level, even in another phrasing or order', () => {
    const keys = exercises.map((e) => {
      const nums = [...e.prompt.matchAll(/(\d+(?:\{,\}\d+)?)\\,\\text\{(cm|mm)\}/g)]
        .map(([, n, unit]) => `${n}${unit}`)
        .sort()
      return `${e.placements[0]!.difficulty}/${e.type}/${e.inspiration.match(/Stufe "([^"]+)"/)![1]}|${nums.join(',')}`
    })
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('never reuses a Pythagorean triple across the two easy levels (template-level uniqueBy)', () => {
    const easy = exercises.filter((e) => e.placements[0]!.difficulty === 'leicht')
    const pairs = easy.map((e) =>
      [...e.prompt.matchAll(/(\d+)\\,\\text\{cm\}/g)]
        .map((m) => Number(m[1]))
        .sort((x, y) => x - y)
        .join('/'),
    )
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('formats multiple-choice options consistently (no option stands out by its decimals)', () => {
    for (const e of exercises) {
      if (e.type !== 'multiple_choice') continue
      const hasComma = e.answer.options.map((o) => o.includes(','))
      expect(new Set(hasComma).size).toBe(1)
    }
  })

  it('stores diagram coordinates without float noise', () => {
    const json = JSON.stringify(exercises.map((e) => e.diagram ?? null))
    expect(json).not.toMatch(/\d\.\d{5,}/)
  })

  it('computes correct answers (independent re-check from the rendered prompt)', () => {
    for (const e of exercises) {
      const nums = [...e.prompt.matchAll(/(\d+(?:\{,\}\d+)?)\\,\\text\{(cm|mm)\}/g)].map(
        ([, n, unit]) => Number(n!.replace('{,}', '.')) / (unit === 'mm' ? 10 : 1),
      )
      expect(nums).toHaveLength(2)
      const c = Math.hypot(nums[0]!, nums[1]!)
      if (e.type === 'numeric') {
        expect(Math.abs(e.answer.value - c)).toBeLessThanOrEqual(e.answer.tolerance + 1e-9)
      } else if (e.type === 'multiple_choice') {
        const chosen = e.answer.options[e.answer.correct[0]!]!
        expect(Number(chosen.replace(' cm', '').replace(',', '.'))).toBeCloseTo(c, 6)
      } else {
        throw new Error(`unexpected type ${e.type}`)
      }
    }
  })

  it('renders every LaTeX fragment without KaTeX errors', () => {
    for (const e of exercises) {
      const texts = [
        e.prompt,
        ...e.solution.steps.map((s) => s.text),
        e.solution.result,
        ...(e.hints ?? []),
      ]
      for (const t of texts) {
        for (const m of t.matchAll(MATH)) {
          expect(() => katex.renderToString(m[1] ?? m[2]!, { throwOnError: true })).not.toThrow()
        }
      }
    }
  })

  it('is deterministic per seed and varies across seeds', () => {
    expect(generateExercises(pilot).map((e) => e.prompt)).toEqual(exercises.map((e) => e.prompt))
    expect(generateExercises(pilot, { seed: 2 }).map((e) => e.prompt)).not.toEqual(
      exercises.map((e) => e.prompt),
    )
  })

  it('continues key numbering from startIndex', () => {
    expect(generateExercises(pilot, { startIndex: 21 })[0]!.key).toBe(
      'pythagoras-hypotenuse-berechnen-021',
    )
  })
})

describe('generateExercises – template errors', () => {
  const minimal = {
    id: 'demo',
    subtopic: 'demo',
    placements: [{ state: 'NW', schoolType: 'gymnasium', grade: 8 }],
    checks: ['x > 0'],
    levels: [
      {
        id: 'l1',
        difficulty: 'leicht',
        count: 3,
        params: { x: { min: 1, max: 2, step: 1 } },
        contexts: [{ id: 'c1', prompt: 'Berechne $2 \\cdot {{x}}$.' }],
        answer: { type: 'numeric', value: '2*x' },
        solution: { steps: ['$2 \\cdot {{x}} = {{2*x}}$'], result: '${{2*x}}$' },
      },
    ],
  }

  it('aborts when not enough distinct exercises are possible', () => {
    expect(() => generateExercises(minimal, { maxAttemptsPerExercise: 20 })).toThrow(/only 2\/3/)
  })

  it('stores numeric answers without float noise', () => {
    const noisy = structuredClone(minimal)
    noisy.levels[0]!.count = 1
    noisy.levels[0]!.answer.value = '0.1 + 0.2'
    expect(generateExercises(noisy)[0]).toMatchObject({ answer: { value: 0.3 } })
  })

  it('aborts on a failing self-check (template bug)', () => {
    expect(() => generateExercises({ ...minimal, checks: ['x > 5'] })).toThrow(
      /template check failed/,
    )
  })

  it('blocks parser-level functions inside expressions', () => {
    const evil = structuredClone(minimal)
    evil.levels[0]!.answer.value = 'evaluate("1+1")'
    expect(() => generateExercises(evil)).toThrow(/disabled/)
  })
})
