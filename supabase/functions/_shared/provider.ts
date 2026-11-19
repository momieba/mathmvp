// Provider abstraction for the handwriting grading: `gradeWithModel` hides which AI service is used.
// Adapter selection via secret GRADING_PROVIDER (default `gemini-developer`). A second adapter
// (target provider before go-live, see docs/TODO.md) only has to implement `ProviderAdapter`.
// The image is only forwarded in the request – it is never stored or logged here.
import {
  FEEDBACK_SCHEMA,
  normalizeModelFeedback,
  type ImageMime,
  type ModelFeedback,
} from './grading.ts'

export type ModelRequest = {
  system: string
  user: string
  image: { mime: ImageMime; base64: string }
  /** JSON Schema (provider neutral) the answer must follow. */
  schema: typeof FEEDBACK_SCHEMA
}

export type AdapterConfig = {
  apiKey: string
  model: string
  signal: AbortSignal
  fetchImpl: typeof fetch
}

/** Returns the raw (parsed JSON) model answer. Throws ProviderError. */
export type ProviderAdapter = (req: ModelRequest, cfg: AdapterConfig) => Promise<unknown>

export type ProviderErrorKind = 'unavailable' | 'rate_limited' | 'invalid_response' | 'timeout'

export class ProviderError extends Error {
  kind: ProviderErrorKind
  status?: number
  constructor(kind: ProviderErrorKind, message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

// --- Adapter: Gemini Developer API (MVP) --------------------------------------------------------

const toGeminiSchema = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(toGeminiSchema)
  if (typeof node !== 'object' || node === null) return node
  return Object.fromEntries(
    Object.entries(node).map(([k, v]) => [
      k,
      k === 'type' && typeof v === 'string' ? v.toUpperCase() : toGeminiSchema(v),
    ]),
  )
}

export const geminiDeveloper: ProviderAdapter = async (req, cfg) => {
  const res = await cfg.fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
      signal: cfg.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: req.user },
              { inline_data: { mime_type: req.image.mime, data: req.image.base64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(req.schema),
          temperature: 0.2,
        },
      }),
    },
  )
  if (res.status === 429) throw new ProviderError('rate_limited', 'provider rate limit', 429)
  if (!res.ok) {
    // Only the status goes to the log, never request or response bodies (may contain the image).
    throw new ProviderError('unavailable', `provider status ${res.status}`, res.status)
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = body.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === 'string')?.text
  if (!text) throw new ProviderError('invalid_response', 'empty model response')
  try {
    return JSON.parse(text)
  } catch {
    throw new ProviderError('invalid_response', 'model response is not JSON')
  }
}

export const ADAPTERS: Record<string, ProviderAdapter> = {
  'gemini-developer': geminiDeveloper,
}

// --- gradeWithModel ---------------------------------------------------------------------------

export type GradeWithModelInput = {
  provider: string
  apiKey: string
  model: string
  system: string
  user: string
  image: { mime: ImageMime; base64: string }
  timeoutMs?: number
  retryDelayMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Asks the model for the structured feedback. One retry on 429/503 (provider overloaded),
 * overall timeout via AbortController. Throws ProviderError.
 */
export async function gradeWithModel(input: GradeWithModelInput): Promise<ModelFeedback> {
  const adapter = ADAPTERS[input.provider]
  if (!adapter) throw new ProviderError('unavailable', `unknown provider ${input.provider}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 45_000)
  const request: ModelRequest = {
    system: input.system,
    user: input.user,
    image: input.image,
    schema: FEEDBACK_SCHEMA,
  }
  const cfg: AdapterConfig = {
    apiKey: input.apiKey,
    model: input.model,
    signal: controller.signal,
    fetchImpl: input.fetchImpl ?? fetch,
  }

  try {
    let raw: unknown
    try {
      raw = await adapter(request, cfg)
    } catch (e) {
      const retryable =
        e instanceof ProviderError && (e.kind === 'rate_limited' || e.status === 503)
      if (!retryable) throw e
      await new Promise((r) => setTimeout(r, input.retryDelayMs ?? 1500))
      raw = await adapter(request, cfg)
    }
    const feedback = normalizeModelFeedback(raw)
    if (!feedback) throw new ProviderError('invalid_response', 'response does not match schema')
    return feedback
  } catch (e) {
    if (e instanceof ProviderError) throw e
    if (controller.signal.aborted) throw new ProviderError('timeout', 'model timeout')
    throw new ProviderError('unavailable', 'request failed')
  } finally {
    clearTimeout(timer)
  }
}
