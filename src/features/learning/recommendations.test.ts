import { isShaky, recommend, wrongStreak } from './recommendations'

const p = (score: number, attemptCount: number) => ({ score, attemptCount })
const pre = (id: string) => ({ id, slug: id, title: id.toUpperCase() })
const video = { title: 'Erklärvideo', url: 'https://example.org/v' }

describe('isShaky', () => {
  it('needs enough attempts before judging the score', () => {
    expect(isShaky(p(10, 5))).toBe(false)
    expect(isShaky(p(39, 6))).toBe(true)
    expect(isShaky(p(40, 6))).toBe(false)
    expect(isShaky(undefined)).toBe(false)
  })

  it('reacts to wrong answers in a row in the session', () => {
    expect(isShaky(p(80, 20), 2)).toBe(false)
    expect(isShaky(p(80, 20), 3)).toBe(true)
    expect(isShaky(undefined, 3)).toBe(true)
  })
})

describe('recommend', () => {
  it('returns nothing while the subtopic is going fine', () => {
    const progress = new Map([['s', p(70, 10)]])
    expect(
      recommend({ subtopicId: 's', progress, prerequisites: [pre('a')], videos: undefined }),
    ).toBeNull()
  })

  it('suggests the weakest prerequisite first', () => {
    const progress = new Map([
      ['s', p(20, 8)],
      ['a', p(45, 5)],
      ['b', p(30, 4)],
      ['c', p(90, 10)],
    ])
    const r = recommend({
      subtopicId: 's',
      progress,
      prerequisites: [pre('a'), pre('b'), pre('c')],
      videos: new Map([['b', [video]]]),
    })
    expect(r).toEqual({ kind: 'prerequisite', subtopic: pre('b'), video })
  })

  it('treats never practised prerequisites as weak, but not barely tried ones', () => {
    const progress = new Map([
      ['s', p(20, 8)],
      ['a', p(10, 2)],
    ])
    expect(
      recommend({ subtopicId: 's', progress, prerequisites: [pre('a')], videos: undefined }),
    ).toEqual({ kind: 'review', video: null })
    expect(
      recommend({ subtopicId: 's', progress, prerequisites: [pre('z')], videos: undefined }),
    ).toEqual({ kind: 'prerequisite', subtopic: pre('z'), video: null })
  })

  it('falls back to the subtopic video, or to the basics without one', () => {
    const progress = new Map([['s', p(20, 8)]])
    expect(
      recommend({
        subtopicId: 's',
        progress,
        prerequisites: [],
        videos: new Map([['s', [video]]]),
      }),
    ).toEqual({ kind: 'review', video })
    expect(recommend({ subtopicId: 's', progress, prerequisites: [], videos: undefined })).toEqual({
      kind: 'review',
      video: null,
    })
  })

  it('uses the session streak', () => {
    const progress = new Map([['s', p(80, 20)]])
    expect(
      recommend({
        subtopicId: 's',
        progress,
        prerequisites: [],
        videos: undefined,
        sessionWrongStreak: 3,
      }),
    ).toEqual({ kind: 'review', video: null })
  })
})

describe('wrongStreak', () => {
  it('counts the trailing wrong answers', () => {
    expect(wrongStreak([])).toBe(0)
    expect(wrongStreak([false, true, false, false])).toBe(2)
    expect(wrongStreak([false, false, false])).toBe(3)
    expect(wrongStreak([false, true])).toBe(0)
  })
})
