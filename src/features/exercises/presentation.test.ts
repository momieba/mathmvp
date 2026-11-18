import { buildPresentation } from './presentation'
import { exerciseSchema } from './schema'

const base = {
  key: 'demo-001',
  subtopic: 'demo',
  placements: [{ state: 'NW', schoolType: 'gymnasium', grade: 8, difficulty: 'leicht' }],
  prompt: 'Aufgabe',
  solution: { steps: [{ text: 'x' }], result: 'x' },
  inspiration: 'test',
}

const parse = (extra: object) => exerciseSchema.parse({ ...base, ...extra })

describe('buildPresentation', () => {
  it('never leaks the correct multiple-choice index', () => {
    const p = buildPresentation(
      parse({ type: 'multiple_choice', answer: { options: ['a', 'b', 'c'], correct: [1] } }),
    )
    expect(p).toEqual({ options: ['a', 'b', 'c'], multi: false })
    expect(JSON.stringify(p)).not.toContain('correct')
  })

  it('exposes only the unit for numeric answers', () => {
    expect(buildPresentation(parse({ type: 'numeric', answer: { value: 5, unit: 'cm' } }))).toEqual(
      {
        unit: 'cm',
      },
    )
  })

  it('never presents ordering items in the solved order', () => {
    const items = ['1', '2', '3', '4']
    const p = buildPresentation(parse({ type: 'ordering', answer: { items } })) as {
      items: string[]
    }
    expect([...p.items].sort()).toEqual(items)
    expect(p.items).not.toEqual(items)
  })

  it('hides true/false values', () => {
    const p = buildPresentation(
      parse({ type: 'true_false', answer: { statements: [{ text: 'A', correct: true }] } }),
    )
    expect(p).toEqual({ statements: ['A'] })
  })
})
