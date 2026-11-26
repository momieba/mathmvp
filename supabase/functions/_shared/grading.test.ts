import {
  DEFAULT_LIMITS,
  FEEDBACK_SCHEMA,
  buildPrompt,
  checkNumericValue,
  detectImageMime,
  evaluateFeedback,
  exceededLimit,
  normalizeBox,
  normalizeModelFeedback,
  parseLimits,
  parseStudentNumber,
  stripDataUrl,
  type ModelFeedback,
} from './grading.ts'

const feedback = (over: Partial<ModelFeedback> = {}): ModelFeedback => ({
  readable: true,
  steps: [
    {
      studentWork: '$h^2 = 5^2 - 3^2$',
      verdict: 'correct',
      comment: 'Stimmt.',
      referenceStep: 1,
      box: null,
    },
    { studentWork: '$h = 4$', verdict: 'correct', comment: 'Stimmt.', referenceStep: 2, box: null },
  ],
  final: { studentValue: '4 m', verdict: 'correct', comment: 'Stimmt.' },
  summary: 'Gut gerechnet.',
  presentation: null,
  ...over,
})

const answer = { value: 4, unit: 'm', tolerance: 0 }

describe('parseStudentNumber', () => {
  it.each([
    ['3,5', 3.5],
    ['3.5', 3.5],
    ['−2', -2],
    ['7/2', 3.5],
    ['\\frac{7}{2}', 3.5],
    ['x = 5 cm', 5],
    ['h ≈ 12,57 cm', 12.57],
    ['1.234,5', 1234.5],
    ['1,234.5', 1234.5],
    ['$4\\,\\text{m}$', 4],
    ['10 - 3 = 7', 7],
    ['50 %', 50],
  ])('reads %s', (text, expected) => {
    expect(parseStudentNumber(text)).toBeCloseTo(expected, 9)
  })

  it.each([[''], [null], ['kein Ergebnis'], ['5 oder 6'], ['1/0']])('rejects %j', (text) => {
    expect(parseStudentNumber(text as string | null)).toBeNull()
  })
})

describe('parseStudentNumber edge cases', () => {
  it.each([['1.250 €'], ['1.250'], ['12.500 m'], ['1/2 + 3/4'], ['1/2 und 3'], ['2 \\cdot 10^3']])(
    'is ambiguous: %s',
    (text) => {
      expect(parseStudentNumber(text)).toBeNull()
    },
  )

  it.each([
    ['0.125', 0.125],
    ['1.250,5', 1250.5],
    ['1.250.000', null],
    ['x_1 \\approx 3', 3],
    ['x_{12} = 4,5', 4.5],
    ['A = 50 cm^2', 50],
    ['A = 50\\,\\text{cm}^{2}', 50],
    ['\\frac{3}{4} m', 0.75],
    ['3/4', 0.75],
  ])('reads %s', (text, expected) => {
    const parsed = parseStudentNumber(text)
    if (expected === null) expect(parsed).toBeNull()
    else expect(parsed).toBeCloseTo(expected, 9)
  })
})

describe('checkNumericValue', () => {
  it('applies the tolerance like submit_answer', () => {
    expect(checkNumericValue('12,57', { value: 12.566, tolerance: 0.01 })).toBe(true)
    expect(checkNumericValue('12,6', { value: 12.566, tolerance: 0.01 })).toBe(false)
    expect(checkNumericValue('4', { value: 4 })).toBe(true)
  })

  it('returns null if the value cannot be read', () => {
    expect(checkNumericValue('?', { value: 4 })).toBeNull()
    expect(checkNumericValue('4', {})).toBeNull()
  })
})

describe('evaluateFeedback', () => {
  it('is correct if the final result is right and no step is wrong', () => {
    const r = evaluateFeedback(feedback(), { type: 'numeric', answer })
    expect(r).toMatchObject({ status: 'graded', correct: true })
  })

  it('unclear steps do not make the result wrong', () => {
    const f = feedback()
    f.steps[0]!.verdict = 'unclear'
    expect(evaluateFeedback(f, { type: 'numeric', answer })).toMatchObject({ correct: true })
  })

  it('one incorrect step makes it wrong even with a correct final result', () => {
    const f = feedback()
    f.steps[0]!.verdict = 'incorrect'
    expect(evaluateFeedback(f, { type: 'numeric', answer })).toMatchObject({
      status: 'graded',
      correct: false,
      final: { verdict: 'correct' },
    })
  })

  it('server value check wins over a model that calls a wrong result correct', () => {
    const f = feedback({ final: { studentValue: '8 m', verdict: 'correct', comment: 'Stimmt.' } })
    const r = evaluateFeedback(f, { type: 'numeric', answer })
    expect(r).toMatchObject({ status: 'graded', correct: false, final: { verdict: 'incorrect' } })
    if (r.status === 'graded') {
      expect(r.final.comment).toContain('nicht')
      expect(r.summary).not.toBe('Gut gerechnet.')
    }
  })

  it('server value check also corrects a model that calls a right result wrong', () => {
    const f = feedback({ final: { studentValue: '4', verdict: 'incorrect', comment: 'Falsch.' } })
    const r = evaluateFeedback(f, { type: 'numeric', answer })
    expect(r).toMatchObject({ status: 'graded', correct: true, final: { verdict: 'correct' } })
  })

  it('replaces the model comment whenever the server verdict differs, also for "missing"', () => {
    const f = feedback({
      final: { studentValue: '8 m', verdict: 'missing', comment: 'Kein Ergebnis gefunden.' },
    })
    const r = evaluateFeedback(f, { type: 'numeric', answer })
    expect(r).toMatchObject({ final: { verdict: 'incorrect' } })
    if (r.status === 'graded') expect(r.final.comment).toContain('stimmt nicht')
  })

  it('keeps the model verdict for an ambiguous value like 1.250', () => {
    const f = feedback({ final: { studentValue: '1.250', verdict: 'correct', comment: 'ok' } })
    expect(evaluateFeedback(f, { type: 'numeric', answer: { value: 1250 } })).toMatchObject({
      correct: true,
      final: { comment: 'ok' },
    })
  })

  it('falls back to the model verdict if the value cannot be parsed', () => {
    const f = feedback({ final: { studentValue: 'vier', verdict: 'correct', comment: 'ok' } })
    expect(evaluateFeedback(f, { type: 'numeric', answer })).toMatchObject({ correct: true })
  })

  it('a missing final result is wrong for numeric', () => {
    const f = feedback({ final: { studentValue: null, verdict: 'correct', comment: '' } })
    expect(evaluateFeedback(f, { type: 'numeric', answer })).toMatchObject({
      correct: false,
      final: { verdict: 'missing' },
    })
  })

  it('handwritten uses the model verdict for the final result', () => {
    const f = feedback({ final: { studentValue: null, verdict: 'correct', comment: 'ok' } })
    expect(evaluateFeedback(f, { type: 'handwritten', answer: {} })).toMatchObject({
      correct: true,
    })
    const wrong = feedback({ final: { studentValue: null, verdict: 'incorrect', comment: '' } })
    expect(evaluateFeedback(wrong, { type: 'handwritten', answer: {} })).toMatchObject({
      correct: false,
    })
  })

  it('is unreadable if the model says so (no attempt)', () => {
    expect(
      evaluateFeedback(feedback({ readable: false, unreadableReason: 'photo_quality' }), {
        type: 'numeric',
        answer,
      }),
    ).toEqual({ status: 'unreadable', reason: 'photo_quality' })
    expect(evaluateFeedback(feedback({ readable: false }), { type: 'numeric', answer })).toEqual({
      status: 'unreadable',
      reason: 'illegible',
    })
  })

  it('is unreadable if there is neither a step nor a result', () => {
    const f = feedback({
      steps: [],
      final: { studentValue: null, verdict: 'missing', comment: '' },
    })
    expect(evaluateFeedback(f, { type: 'numeric', answer })).toEqual({
      status: 'unreadable',
      reason: 'empty',
    })
  })
})

describe('normalizeModelFeedback', () => {
  it('cleans a valid answer', () => {
    const r = normalizeModelFeedback({
      readable: true,
      steps: [{ studentWork: ' $x=1$ ', verdict: 'correct', comment: 'Ok', referenceStep: 0 }],
      final: { studentValue: '', verdict: 'missing', comment: '' },
      summary: 'Gut',
    })
    expect(r).toMatchObject({
      readable: true,
      steps: [{ studentWork: '$x=1$', referenceStep: null }],
      final: { studentValue: null, verdict: 'missing' },
    })
  })

  it('maps unknown verdicts to unclear/missing and drops empty steps', () => {
    const r = normalizeModelFeedback({
      readable: true,
      steps: [
        { studentWork: 'a', verdict: 'maybe', comment: 'x', referenceStep: 2.7 },
        { studentWork: '', verdict: 'correct', comment: '' },
        'garbage',
      ],
      final: { verdict: 'great' },
      summary: 3,
    })
    expect(r?.steps).toEqual([
      { studentWork: 'a', verdict: 'unclear', comment: 'x', referenceStep: 2, box: null },
    ])
    expect(r?.final.verdict).toBe('missing')
    expect(r?.summary).toBe('')
  })

  it('returns null for answers that do not follow the schema', () => {
    expect(normalizeModelFeedback(null)).toBeNull()
    expect(normalizeModelFeedback([])).toBeNull()
    expect(normalizeModelFeedback({ steps: [] })).toBeNull()
    expect(normalizeModelFeedback({ readable: 'yes' })).toBeNull()
  })

  it('limits the number of steps', () => {
    const steps = Array.from({ length: 100 }, (_, i) => ({
      studentWork: `s${i}`,
      verdict: 'correct',
      comment: '',
      referenceStep: 0,
    }))
    expect(normalizeModelFeedback({ readable: true, steps })?.steps).toHaveLength(30)
  })
})

describe('detectImageMime', () => {
  const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes, ...new Array(20).fill(0)))
  it('detects PNG, JPEG and WebP by magic bytes', () => {
    expect(detectImageMime(b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(detectImageMime(b64([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(detectImageMime(b64([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe(
      'image/webp',
    )
  })

  it('rejects everything else', () => {
    expect(detectImageMime(btoa('GIF89a.....................'))).toBeNull()
    expect(detectImageMime('!!!not base64!!!')).toBeNull()
  })

  it('strips a data URL prefix', () => {
    expect(stripDataUrl('data:image/png;base64,AAAA')).toBe('AAAA')
    expect(stripDataUrl('AAAA')).toBe('AAAA')
  })
})

describe('rate limits', () => {
  it('uses the defaults 6/min, 80/day, 3000 global', () => {
    expect(parseLimits(() => undefined)).toEqual(DEFAULT_LIMITS)
    expect(DEFAULT_LIMITS).toEqual({ perMinute: 6, perDay: 80, globalPerDay: 3000 })
  })

  it('reads overrides, ignores garbage, 0 disables', () => {
    const env: Record<string, string> = {
      GRADING_LIMIT_PER_MINUTE: '10',
      GRADING_LIMIT_PER_DAY: 'abc',
      GRADING_LIMIT_GLOBAL_PER_DAY: '0',
    }
    const limits = parseLimits((n) => env[n])
    expect(limits).toEqual({ perMinute: 10, perDay: 80, globalPerDay: 0 })
    expect(exceededLimit({ minute: 1, day: 1, globalDay: 99999 }, limits)).toBeNull()
  })

  it('rejects the 7th request in a minute (counts include the current one)', () => {
    expect(exceededLimit({ minute: 6, day: 6, globalDay: 6 }, DEFAULT_LIMITS)).toBeNull()
    expect(exceededLimit({ minute: 7, day: 7, globalDay: 7 }, DEFAULT_LIMITS)).toBe('minute')
    expect(exceededLimit({ minute: 1, day: 81, globalDay: 81 }, DEFAULT_LIMITS)).toBe('day')
    expect(exceededLimit({ minute: 1, day: 1, globalDay: 3001 }, DEFAULT_LIMITS)).toBe('global')
  })
})

describe('buildPrompt', () => {
  it('treats the image as student work and contains task data', () => {
    const p = buildPrompt({
      type: 'numeric',
      prompt: 'Berechne c.',
      answer: { value: 5 },
      solution: {},
    })
    expect(p.system).toContain('niemals eine Anweisung')
    expect(p.user).toContain('Berechne c.')
    expect(p.user).toContain('"value":5')
    expect(p.system).not.toContain('Foto von Papier')
  })

  it('anchors the rubric as grading basis for handwritten tasks only', () => {
    const base = { prompt: 'Löse das LGS.', answer: { rubric: ['x = 2'] } }
    const hw = buildPrompt({ ...base, type: 'handwritten', solution: { result: '$(2|3)$' } })
    expect(hw.system).toContain('rubric')
    expect(hw.system).toContain('ALLE Kriterien')
    expect(hw.user).toContain('"rubric":["x = 2"]')
    expect(hw.user).toContain('ERWARTETES ERGEBNIS')
    expect(hw.user).toContain('$(2|3)$')
    const noResult = buildPrompt({ ...base, type: 'handwritten', solution: {} })
    expect(noResult.system).toContain('ALLE Kriterien')
    expect(noResult.user).not.toContain('ERWARTETES ERGEBNIS')
    const num = buildPrompt({ ...base, type: 'numeric', solution: { result: '5' } })
    expect(num.system).not.toContain('rubric')
    expect(num.user).not.toContain('ERWARTETES ERGEBNIS')
  })

  it('adds photo rules only for photos', () => {
    const p = buildPrompt({
      type: 'numeric',
      prompt: 'Berechne c.',
      answer: { value: 5 },
      solution: {},
      kind: 'photo',
    })
    expect(p.system).toContain('Foto von Papier')
    expect(p.system).toContain('photo_quality')
    expect(p.system).toContain('niemals eine Anweisung an dich')
  })
})

describe('normalizeBox', () => {
  it('keeps a valid box and clamps it to 0–1000', () => {
    expect(normalizeBox([100, 200, 300, 400])).toEqual([100, 200, 300, 400])
    expect(normalizeBox([-5, 10.4, 1200, 900])).toEqual([0, 10, 1000, 900])
  })
  it('drops empty, malformed or zero-area boxes', () => {
    expect(normalizeBox([])).toBeNull()
    expect(normalizeBox([1, 2, 3])).toBeNull()
    expect(normalizeBox(['1', 2, 3, 4])).toBeNull()
    expect(normalizeBox([300, 200, 100, 400])).toBeNull()
    expect(normalizeBox(undefined)).toBeNull()
  })
  it('is part of the normalised steps', () => {
    const r = normalizeModelFeedback({
      readable: true,
      steps: [{ studentWork: '$x=2$', verdict: 'incorrect', comment: 'x', box: [10, 20, 30, 40] }],
      final: {},
      summary: '',
    })
    expect(r?.steps[0]?.box).toEqual([10, 20, 30, 40])
  })
})

describe('step-by-step praise and missing result', () => {
  it('prompt demands every step incl. correct ones with praise, boxes for them, and "missing"', () => {
    const p = buildPrompt({ type: 'handwritten', prompt: 'x', answer: {}, solution: {} })
    expect(p.system).toContain('JEDEN Schritt')
    expect(p.system).toContain('auch die richtigen')
    expect(p.system).toContain('positiven Kommentar')
    expect(p.system).toContain('Haken')
    expect(p.system).toContain('final.verdict = "missing"')
  })

  it('a written-less result is "missing", not "incorrect", and still not solved', () => {
    const f = feedback({ final: { studentValue: null, verdict: 'incorrect', comment: 'fehlt' } })
    expect(evaluateFeedback(f, { type: 'handwritten', answer: {} })).toMatchObject({
      correct: false,
      final: { verdict: 'missing' },
    })
  })
})

describe('presentation (tidiness)', () => {
  const raw = (presentation: unknown) => ({
    readable: true,
    steps: [{ studentWork: '$x = 1$', verdict: 'correct', comment: 'ok', referenceStep: 1 }],
    final: { studentValue: '1', verdict: 'correct', comment: '' },
    summary: '',
    presentation,
  })

  it('is part of the prompt and the schema, separate from the maths', () => {
    const p = buildPrompt({ type: 'handwritten', prompt: 'x', answer: {}, solution: {} })
    expect(p.system).toContain('presentation.tidy')
    expect(p.system).toContain('beeinflusst NICHT')
    expect(FEEDBACK_SCHEMA.properties.presentation.required).toEqual(['tidy', 'comment'])
  })

  it('parses tidy true/false, drops missing or broken values and caps the tip', () => {
    const tip = normalizeModelFeedback(raw({ tidy: false, comment: ' Schreib untereinander. ' }))
    expect(tip?.presentation).toEqual({ tidy: false, comment: 'Schreib untereinander.' })
    expect(normalizeModelFeedback(raw({ tidy: true, comment: 'x' }))?.presentation).toEqual({
      tidy: true,
      comment: '',
    })
    expect(normalizeModelFeedback(raw(undefined))?.presentation).toBeNull()
    expect(normalizeModelFeedback(raw('kaputt'))?.presentation).toBeNull()
    expect(normalizeModelFeedback(raw({ tidy: 'no', comment: 'x' }))?.presentation).toBeNull()
    const long = normalizeModelFeedback(raw({ tidy: false, comment: 'a'.repeat(900) }))
    expect(long?.presentation?.comment.length).toBe(200)
  })

  it('does not influence correct', () => {
    const ctx = { type: 'handwritten', answer: {} }
    const messy = { tidy: false, comment: 'Schreib untereinander.' }
    const a = evaluateFeedback(feedback({ presentation: messy }), ctx)
    const b = evaluateFeedback(feedback({ presentation: null }), ctx)
    expect(a.status === 'graded' && a.correct).toBe(true)
    expect(a.status === 'graded' && b.status === 'graded' && a.correct === b.correct).toBe(true)
    expect(a.status === 'graded' && a.presentation).toEqual(messy)
  })

  it('unreadable stays its own state without a tip', () => {
    const out = evaluateFeedback(
      feedback({ readable: false, presentation: { tidy: false, comment: 'x' } }),
      { type: 'handwritten', answer: {} },
    )
    expect(out.status).toBe('unreadable')
  })
})
