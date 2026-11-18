import { grades, schoolTypeLabels, sortedEntries, stateLabels } from './labels'
import { gradeSchema, schoolTypeSchema, stateSchema } from './schema'

describe('curriculum labels', () => {
  it('label every state and school type', () => {
    expect(Object.keys(stateLabels).sort()).toEqual([...stateSchema.options].sort())
    expect(Object.keys(schoolTypeLabels).sort()).toEqual([...schoolTypeSchema.options].sort())
  })

  it('only offers valid grades', () => {
    grades.forEach((g) => expect(gradeSchema.safeParse(g).success).toBe(true))
  })

  it('sorts entries by German label', () => {
    const labels = sortedEntries(stateLabels).map(([, l]) => l)
    expect(labels[0]).toBe('Baden-Württemberg')
    expect(labels.at(-1)).toBe('Thüringen')
  })
})
