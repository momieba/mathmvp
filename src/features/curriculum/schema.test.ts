import { exampleCurriculumDraft } from './example-draft'
import { curriculumDraftSchema } from './schema'

type Draft = typeof exampleCurriculumDraft
const clone = (): Draft => structuredClone(exampleCurriculumDraft)
const firstTopic = (d: Draft) => d.topics[0]!

const errors = (draft: unknown) => {
  const r = curriculumDraftSchema.safeParse(draft)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe('curriculumDraftSchema', () => {
  it('accepts the reference example', () => {
    expect(errors(exampleCurriculumDraft)).toEqual([])
  })

  it('requires at least 20 exercises per subtopic', () => {
    const d = clone()
    firstTopic(d).subtopics[0]!.exercisePlan.targetCount = 19
    expect(errors(d).length).toBeGreaterThan(0)
  })

  it('requires the difficulty mix to add up to 100', () => {
    const d = clone()
    firstTopic(d).subtopics[0]!.exercisePlan.difficultyMix = { leicht: 50, mittel: 30 }
    expect(errors(d)).toContain('difficultyMix must add up to 100')
  })

  it('rejects stages that go backwards in the learning order', () => {
    const d = clone()
    const subs = firstTopic(d).subtopics
    ;(subs[2] as { stage: string }).stage = 'einstieg'
    expect(errors(d).some((m) => m.includes('must not come after'))).toBe(true)
  })

  it('rejects prerequisites that come later in the same topic', () => {
    const d = clone()
    firstTopic(d).subtopics[0]!.prerequisites = ['pythagoras-textaufgaben']
    expect(errors(d).some((m) => m.includes('must come before'))).toBe(true)
  })

  it('requires a video or a reason for skipping it', () => {
    const d = clone()
    const sub = firstTopic(d).subtopics[0]! as { videos: unknown[]; videoSkipReason?: string }
    sub.videos = []
    expect(errors(d).some((m) => m.includes('videoSkipReason'))).toBe(true)
    sub.videoSkipReason = 'Reine Wiederholung, Video aus dem Einstieg reicht.'
    expect(errors(d)).toEqual([])
  })

  it('rejects duplicate slugs across the draft', () => {
    const d = clone()
    firstTopic(d).subtopics[1]!.slug = 'pythagoras-begriffe'
    expect(errors(d).some((m) => m.includes('duplicate slug'))).toBe(true)
  })
})
