import type { Database } from '@/types/database'
import { grades, schoolTypeLabels, sortedEntries, stateLabels } from './labels'
import { gradeSchema, schoolTypeSchema, stateSchema } from './schema'

type DbEnums = Database['public']['Enums']

// Compile-time check: Zod enums and DB enums must be identical.
const sameStates: [DbEnums['state_code'], (typeof stateSchema.options)[number]] extends [
  (typeof stateSchema.options)[number],
  DbEnums['state_code'],
]
  ? true
  : false = true
const sameSchoolTypes: [DbEnums['school_type'], (typeof schoolTypeSchema.options)[number]] extends [
  (typeof schoolTypeSchema.options)[number],
  DbEnums['school_type'],
]
  ? true
  : false = true

describe('curriculum labels', () => {
  it('stay in sync with the DB enums', () => {
    expect(sameStates && sameSchoolTypes).toBe(true)
  })

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
