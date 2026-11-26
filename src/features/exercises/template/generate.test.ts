import katex from 'katex'
import pilot from './examples/pythagoras-hypotenuse-berechnen.json'
import lgs from './examples/lgs-zahlenpaar-handwritten.json'
import { generateExercises } from './generate'
import { texFraction, texSigned } from './format'

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

describe('generateExercises – handwritten example (LGS, Lösungspaar)', () => {
  const exercises = generateExercises(lgs)

  it('produces schema-valid handwritten exercises with rubric and result', () => {
    expect(exercises).toHaveLength(10)
    for (const e of exercises) {
      expect(e.type).toBe('handwritten')
      if (e.type !== 'handwritten') continue
      expect(e.answer.rubric.length).toBeGreaterThanOrEqual(3)
      expect(e.answer.rubric.join(' ')).not.toContain('{{')
      expect(e.solution.result).toMatch(/^\$L = \\\{\(-?\d+\\,\|\\,-?\d+\)\\\}\$$/)
    }
  })

  it('follows the R8/R5 step scheme without "1 \\cdot" or "+ -"', () => {
    for (const e of exercises) {
      const steps = e.solution.steps.map((s) => s.text)
      expect(steps[0]).toBe('Ziel: Vor $y$ sollen Gegenzahlen stehen.')
      expect(steps.some((s) => /^I′? [+] II: /.test(s))).toBe(true)
      expect(steps.at(-2)).toMatch(/^\$x = -?\d+\$ in I einsetzen: .*, also \$y = -?\d+\$$/)
      expect(steps.at(-1)).toMatch(/^Probe in II: .* ✓$/)
      for (const s of steps) {
        expect(s).not.toMatch(/(^|[^\d])1 \\cdot|\+ -|\$1x|[+-] 1[xy]/)
        if (s.startsWith('Durch ')) expect(s).not.toMatch(/^Durch \$1\$/)
      }
    }
  })

  it('states a solution pair that satisfies both equations of the prompt', () => {
    for (const e of exercises) {
      const eq = [...e.prompt.matchAll(/& (-?\d+)x ([+-]) (\d+)y = (-?\d+)/g)]
      expect(eq).toHaveLength(2)
      const [x, y] = [...e.solution.result.matchAll(/-?\d+/g)].map((m) => Number(m[0]))
      for (const [, a, s, b, c] of eq) {
        expect(Number(a) * x! + (s === '-' ? -1 : 1) * Number(b) * y!).toBe(Number(c))
      }
    }
  })

  it('is deterministic per seed and varies across seeds', () => {
    expect(generateExercises(lgs)).toEqual(exercises)
    expect(generateExercises(lgs, { seed: 5 }).map((e) => e.prompt)).not.toEqual(
      exercises.map((e) => e.prompt),
    )
  })

  it('renders every LaTeX fragment without KaTeX errors', () => {
    for (const e of exercises) {
      const texts = [
        e.prompt,
        ...e.solution.steps.map((s) => s.text),
        e.solution.result,
        ...(e.hints ?? []),
        ...(e.type === 'handwritten' ? e.answer.rubric : []),
      ]
      for (const t of texts) {
        for (const m of t.matchAll(MATH)) {
          expect(() => katex.renderToString(m[1] ?? m[2]!, { throwOnError: true })).not.toThrow()
        }
      }
    }
  })

  it('aborts when the template is wrong (check fails)', () => {
    const wrongC = structuredClone(lgs)
    wrongC.derived.c2 = 'a2 * x + b2 * y + 1'
    expect(() => generateExercises(wrongC)).toThrow(/template check failed/)
  })
})

describe('generateExercises – numeric with fraction result', () => {
  const slope = {
    id: 'slope',
    subtopic: 'slope',
    placements: [{ state: 'NW', schoolType: 'gymnasium', grade: 8 }],
    checks: ['abs(m * dx - dy) < 1e-9'],
    levels: [
      {
        id: 'bruch',
        difficulty: 'mittel',
        count: 1,
        params: { dx: { values: [3] }, dy: { values: [8] } },
        derived: { m: 'dy / dx' },
        contexts: [{ id: 'c', prompt: 'Steigung bei $\\Delta x = {{dx}}$, $\\Delta y = {{dy}}$?' }],
        answer: { type: 'numeric', value: 'm', tolerance: '0.005' },
        solution: {
          steps: ['$m = \\frac{ {{dy}} }{ {{dx}} }$'],
          result: '$m = {{frac(m)}} \\approx {{m:2}}$',
        },
      },
    ],
  }

  it('keeps the exact value with tolerance and shows the fraction in the model solution', () => {
    const [e] = generateExercises(slope)
    // stored value is rounded to 9 decimals (float-noise cleanup) – far below the tolerance
    expect(e).toMatchObject({ type: 'numeric', answer: { tolerance: 0.005 } })
    expect(e!.type === 'numeric' && e!.answer.value).toBeCloseTo(8 / 3, 8)
    expect(e!.solution.result).toBe('$m = \\frac{8}{3} \\approx 2{,}67$')
  })

  it('formats negative and integer fractions', () => {
    expect(texFraction(-2 / 3)).toBe('-\\frac{2}{3}')
    expect(texFraction(6 / 3)).toBe('2')
    expect(texFraction(0.375)).toBe('\\frac{3}{8}')
    expect(texSigned(-3)).toBe('- 3')
    expect(texSigned(2.5)).toBe('+ 2{,}5')
    expect(() => texFraction(Math.PI)).toThrow()
  })
})

describe('generateExercises – keys stay stable when a level changes type (--force)', () => {
  const base = {
    id: 'mix',
    subtopic: 'mix',
    placements: [{ state: 'NW', schoolType: 'gymnasium', grade: 8 }],
    checks: ['a > 0'],
    levels: [
      {
        id: 'l1',
        difficulty: 'leicht',
        count: 3,
        params: { a: { min: 1, max: 9, step: 1 } },
        contexts: [{ id: 'c', prompt: 'Berechne $2 \\cdot {{a}}$.' }],
        answer: { type: 'multiple_choice', correct: '{{2*a}}', distractors: ['{{2*a+1}}'] },
        solution: { steps: ['$2 \\cdot {{a}}$'], result: '${{2*a}}$' },
      },
      {
        id: 'l2',
        difficulty: 'mittel',
        count: 2,
        params: { a: { min: 1, max: 9, step: 1 } },
        contexts: [{ id: 'c', prompt: 'Berechne $3 \\cdot {{a}}$.' }],
        answer: { type: 'multiple_choice', correct: '{{3*a}}', distractors: ['{{3*a+1}}'] },
        solution: { steps: ['$3 \\cdot {{a}}$'], result: '${{3*a}}$' },
      },
    ],
  }

  it('yields the same keys, order and placements for MC → numeric / handwritten', () => {
    const asNumeric = structuredClone(base) as { levels: { answer: unknown }[] }
    asNumeric.levels[0]!.answer = { type: 'numeric', value: '2*a' }
    const asHandwritten = structuredClone(base) as { levels: { answer: unknown }[] }
    asHandwritten.levels[1]!.answer = { type: 'handwritten', rubric: ['Ergebnis ${{3*a}}$.'] }
    const keys = (t: unknown) => generateExercises(t, { startIndex: 1 }).map((e) => e.key)
    const expected = ['mix-001', 'mix-002', 'mix-003', 'mix-004', 'mix-005']
    expect(keys(base)).toEqual(expected)
    expect(keys(asNumeric)).toEqual(expected)
    expect(keys(asHandwritten)).toEqual(expected)
    expect(generateExercises(asHandwritten).map((e) => e.type)).toEqual([
      'multiple_choice',
      'multiple_choice',
      'multiple_choice',
      'handwritten',
      'handwritten',
    ])
  })
})

describe('generateExercises – placeholder helpers and optional steps', () => {
  const template = {
    id: 'opt',
    subtopic: 'opt',
    placements: [{ state: 'NW', schoolType: 'gymnasium', grade: 8 }],
    checks: ['k * x == r'],
    levels: [
      {
        id: 'l1',
        difficulty: 'leicht',
        count: 4,
        params: { k: { values: [1, -1, 2, -3] }, x: { values: [4] } },
        derived: { r: 'k * x' },
        uniqueBy: 'k',
        contexts: [{ id: 'c', prompt: '${{coef(k)}}x = {{r}}$' }],
        answer: { type: 'numeric', value: 'x' },
        solution: {
          steps: [
            'Ansatz: ${{coef(k)}}x = {{r}}$',
            { text: 'Durch ${{k}}$ teilen: $x = {{x}}$', when: 'k != 1' },
            '${{r}} {{signedTerm(k, "x")}}$',
            'Probe: ${{times(k, x)}} = {{r}}$',
          ],
          result: '$x = {{x}}$',
        },
      },
    ],
  }

  it('drops steps whose condition is false, keeps order and keys', () => {
    const list = generateExercises(template)
    expect(list.map((e) => e.key)).toEqual(['opt-001', 'opt-002', 'opt-003', 'opt-004'])
    const byK = Object.fromEntries(list.map((e) => [e.prompt, e.solution.steps.map((s) => s.text)]))
    expect(byK['$x = 4$']).toEqual(['Ansatz: $x = 4$', '$4 + x$', 'Probe: $4 = 4$'])
    expect(byK['$-x = -4$']).toEqual([
      'Ansatz: $-x = -4$',
      'Durch $-1$ teilen: $x = 4$',
      '$-4 - x$',
      'Probe: $-4 = -4$',
    ])
    expect(byK['$2x = 8$']).toContain('Probe: $2 \\cdot 4 = 8$')
  })

  it('does not change the other output when conditions are added (determinism)', () => {
    const plain = structuredClone(template) as typeof template
    plain.levels[0]!.solution.steps = ['Ansatz: ${{coef(k)}}x = {{r}}$']
    const a = generateExercises(template).map((e) => [e.key, e.prompt])
    const b = generateExercises(plain).map((e) => [e.key, e.prompt])
    expect(a).toEqual(b)
  })

  it('rejects a non-boolean condition', () => {
    const bad = structuredClone(template) as typeof template
    bad.levels[0]!.solution.steps = [{ text: 'x', when: 'k' }]
    expect(() => generateExercises(bad)).toThrow(/true\/false/)
  })
})
