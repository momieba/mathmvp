import { skillCatalogSchema, type Skill } from './schema'

const skill = (over: Partial<Skill> = {}): Skill => ({
  slug: 'bruchrechnung',
  title: 'Bruchrechnung',
  description: 'Mit Brüchen rechnen.',
  category: 'arithmetik',
  gradeFrom: 6,
  homeSubtopics: ['brueche-addieren'],
  ...over,
})

const messages = (skills: Skill[]) => {
  const r = skillCatalogSchema.safeParse({ skills })
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe('skillCatalogSchema', () => {
  it('accepts a catalog with parent groups', () => {
    expect(
      messages([skill(), skill({ slug: 'brueche-addieren', parent: 'bruchrechnung' })]),
    ).toEqual([])
  })

  it('rejects duplicate slugs and duplicate home subtopics', () => {
    expect(messages([skill(), skill()])).toContain('duplicate skill slug "bruchrechnung"')
    expect(messages([skill({ homeSubtopics: ['a', 'a'] })])).toContain('duplicate home subtopic')
  })

  it('needs at least one home subtopic', () => {
    expect(messages([skill({ homeSubtopics: [] })]).length).toBeGreaterThan(0)
  })

  it('rejects unknown parents and cycles', () => {
    expect(messages([skill({ parent: 'gibt-es-nicht' })])).toContain(
      'unknown parent "gibt-es-nicht"',
    )
    const cycle = messages([skill({ slug: 'a', parent: 'b' }), skill({ slug: 'b', parent: 'a' })])
    expect(cycle).toContain('parent cycle at "a"')
    expect(messages([skill({ parent: 'bruchrechnung' })])).toContain(
      'parent cycle at "bruchrechnung"',
    )
  })

  it('limits the grade to 5–13', () => {
    expect(messages([skill({ gradeFrom: 4 })]).length).toBeGreaterThan(0)
    expect(messages([skill({ gradeFrom: 14 })]).length).toBeGreaterThan(0)
  })
})
