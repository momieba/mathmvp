import { exerciseDraftFileSchema, exerciseSchema } from './schema'

const base = {
  key: 'pythagoras-hypotenuse-berechnen-001',
  subtopic: 'pythagoras-hypotenuse-berechnen',
  placements: [{ state: 'NW', schoolType: 'gymnasium', grade: 9, difficulty: 'leicht' }],
  prompt: 'Ein rechtwinkliges Dreieck hat die Katheten $a = 3$ cm und $b = 4$ cm. Berechne $c$.',
  solution: {
    steps: [{ text: '$c = \\sqrt{a^2 + b^2} = \\sqrt{9 + 16} = 5$' }],
    result: '$c = 5$ cm',
  },
  inspiration: 'Standard-Einstiegsaufgabe zum Satz des Pythagoras; eigene Zahlen und Formulierung.',
}

describe('exerciseSchema', () => {
  it('accepts a numeric exercise and applies default tolerance', () => {
    const parsed = exerciseSchema.parse({
      ...base,
      type: 'numeric',
      answer: { value: 5, unit: 'cm' },
    })
    expect(parsed.type === 'numeric' && parsed.answer.tolerance).toBe(0)
  })

  it('rejects multiple choice with out-of-range correct index', () => {
    const result = exerciseSchema.safeParse({
      ...base,
      type: 'multiple_choice',
      answer: { options: ['5 cm', '7 cm'], correct: [2] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects cloze when gap markers and gaps differ', () => {
    const result = exerciseSchema.safeParse({
      ...base,
      prompt: 'Es gilt $c^2 = $ {{1}} $+$ {{2}}.',
      type: 'cloze',
      answer: { gaps: [{ accepted: ['a^2'] }] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects duplicate placements', () => {
    const result = exerciseSchema.safeParse({
      ...base,
      placements: [base.placements[0], { ...base.placements[0], difficulty: 'schwer' }],
      type: 'numeric',
      answer: { value: 5 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects answer shape that does not match the type', () => {
    const result = exerciseSchema.safeParse({ ...base, type: 'term', answer: { value: 5 } })
    expect(result.success).toBe(false)
  })
})

describe('exerciseDraftFileSchema', () => {
  it('rejects duplicate keys within a file', () => {
    const ex = { ...base, type: 'numeric', answer: { value: 5 } }
    expect(exerciseDraftFileSchema.safeParse({ exercises: [ex, ex] }).success).toBe(false)
  })
})
