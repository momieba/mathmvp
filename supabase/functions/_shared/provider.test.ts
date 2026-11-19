import { ProviderError, gradeWithModel } from './provider.ts'

const valid = {
  readable: true,
  steps: [{ studentWork: '$x=1$', verdict: 'correct', comment: 'Ok', referenceStep: 1 }],
  final: { studentValue: '1', verdict: 'correct', comment: 'Ok' },
  summary: 'Gut',
}
const geminiBody = (payload: unknown) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
  )

const base = {
  provider: 'gemini-developer',
  apiKey: 'test-key',
  model: 'test-model',
  system: 'sys',
  user: 'usr',
  image: { mime: 'image/png' as const, base64: 'AAAA' },
  retryDelayMs: 0,
}

describe('gradeWithModel (gemini-developer)', () => {
  it('sends system prompt, image and an upper-case response schema, returns normalised feedback', async () => {
    const fetchImpl = vi.fn(async () => geminiBody(valid))
    const result = await gradeWithModel({ ...base, fetchImpl })
    expect(result.steps).toHaveLength(1)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/models/test-model:generateContent')
    const sent = JSON.parse(init.body as string)
    expect(sent.systemInstruction.parts[0].text).toBe('sys')
    expect(sent.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/png', data: 'AAAA' })
    expect(sent.generationConfig.responseSchema.type).toBe('OBJECT')
    expect(sent.generationConfig.responseSchema.properties.steps.items.type).toBe('OBJECT')
    // key travels in a header, not in the URL
    expect(url).not.toContain('test-key')
  })

  it('retries once on 429 and then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(geminiBody(valid))
    await expect(gradeWithModel({ ...base, fetchImpl })).resolves.toBeTruthy()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry other errors', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }))
    await expect(gradeWithModel({ ...base, fetchImpl })).rejects.toMatchObject({
      kind: 'unavailable',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('rejects a response that does not follow the schema', async () => {
    const fetchImpl = vi.fn(async () => geminiBody({ nope: true }))
    await expect(gradeWithModel({ ...base, fetchImpl })).rejects.toMatchObject({
      kind: 'invalid_response',
    })
  })

  it('rejects non-JSON model text', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hello' }] } }] })),
    )
    await expect(gradeWithModel({ ...base, fetchImpl })).rejects.toBeInstanceOf(ProviderError)
  })

  it('times out via AbortController', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')))
        }),
    )
    await expect(
      gradeWithModel({ ...base, timeoutMs: 20, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('rejects an unknown provider', async () => {
    await expect(gradeWithModel({ ...base, provider: 'nope' })).rejects.toMatchObject({
      kind: 'unavailable',
    })
  })
})
