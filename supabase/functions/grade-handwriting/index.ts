// Grades a handwritten solution (drawing from the canvas, later also photos) step by step against
// the reference solution, records the attempt and returns the correction + the model solution.
// The image is only forwarded to the model and never stored or logged.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY                     API key of the provider `gemini-developer`
//   GRADING_PROVIDER (optional)        adapter name, default `gemini-developer`
//   GEMINI_MODEL (optional)            model id, default see DEFAULT_MODEL
//   GRADING_LIMIT_PER_MINUTE / _PER_DAY / _GLOBAL_PER_DAY (optional) defaults 6 / 80 / 3000, 0 = off
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the runtime.
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  GRADABLE_TYPES,
  buildPrompt,
  detectImageMime,
  evaluateFeedback,
  exceededLimit,
  parseLimits,
  stripDataUrl,
} from '../_shared/grading.ts'
import { ProviderError, gradeWithModel } from '../_shared/provider.ts'

const DEFAULT_MODEL = 'gemini-3.1-flash-lite'
const MAX_IMAGE_BASE64 = 2_000_000 // base64 length limit
const MAX_BODY_BYTES = 2_100_000
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const EXAM_GRACE_MS = MINUTE // keep in sync with private.exam_grace()

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', ...headers },
  })

const limitMessages = {
  minute: 'Zu viele Korrekturen in kurzer Zeit. Warte eine Minute und gib dann noch einmal ab.',
  day: 'Du hast heute viele Lösungen korrigieren lassen und das Tageslimit erreicht. Üb morgen weiter oder nimm in der Zwischenzeit Aufgaben mit Auswahlantworten.',
  global:
    'Die Korrektur ist heute sehr gefragt und gerade ausgelastet. Versuch es morgen noch einmal.',
} as const

// Etappe 4 swaps this for `record_graded_attempt` (hint credit); until then the function inserts
// the attempt itself with the service role.
type Admin = ReturnType<typeof createClient>
async function recordGradedAttempt(
  admin: Admin,
  args: {
    userId: string
    exerciseId: string
    subtopicId: string
    correct: boolean
    answer: Record<string, unknown>
    feedback: Record<string, unknown>
  },
) {
  const { error } = await admin.from('attempts').insert({
    user_id: args.userId,
    exercise_id: args.exerciseId,
    subtopic_id: args.subtopicId,
    correct: args.correct,
    answer: args.answer,
    feedback: args.feedback,
  })
  return error
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // Reject oversized bodies before reading them (base64 limit + JSON overhead).
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json(
      {
        error: 'Das Bild ist zu groß. Versuch es noch einmal mit weniger Inhalt.',
      },
      413,
    )
  }

  const provider = Deno.env.get('GRADING_PROVIDER') ?? 'gemini-developer'
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'Die Korrektur ist nicht eingerichtet.' }, 500)
  const model = Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL

  // --- who is calling? (JWT verified by the platform; resolve the user from it) ---------------
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Bitte melde dich neu an.' }, 401)
  const userId = userData.user.id

  // --- input ------------------------------------------------------------------------------------
  let body: { exerciseId?: unknown; image?: unknown; kind?: unknown; examSessionId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON' }, 400)
  }
  if (typeof body.exerciseId !== 'string' || typeof body.image !== 'string') {
    return json({ error: 'exerciseId and image are required' }, 400)
  }
  const image = stripDataUrl(body.image)
  if (image === '') return json({ error: 'exerciseId and image are required' }, 400)
  const kind = body.kind === 'photo' ? 'photo' : 'drawing'
  const examSessionId = typeof body.examSessionId === 'string' ? body.examSessionId : null
  if (image.length > MAX_IMAGE_BASE64) {
    return json(
      {
        error:
          kind === 'photo'
            ? 'Das Foto ist zu groß. Mach ein neues Foto oder wähl ein kleineres Bild.'
            : 'Das Bild ist zu groß. Schreib etwas kleiner oder lösch Unnötiges.',
      },
      413,
    )
  }
  const mime = detectImageMime(image)
  if (!mime) return json({ error: 'Dieses Bildformat wird nicht unterstützt.' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // --- exam mode: the session must be the caller's, still open and contain the exercise -----------
  const examOpen = async () => {
    const { data: session } = await admin
      .from('exam_sessions')
      .select('id, exercise_ids, deadline_at, submitted_at')
      .eq('id', examSessionId!)
      .eq('user_id', userId)
      .maybeSingle()
    if (!session) return 'missing' as const
    const over =
      session.submitted_at !== null ||
      Date.now() > new Date(session.deadline_at).getTime() + EXAM_GRACE_MS
    if (over) return 'over' as const
    return session.exercise_ids.includes(body.exerciseId as string)
      ? ('ok' as const)
      : ('missing' as const)
  }
  if (examSessionId) {
    const state = await examOpen()
    if (state === 'missing') return json({ error: 'Diese Prüfung gibt es nicht.' }, 404)
    if (state === 'over') return json({ error: 'Die Prüfungszeit ist abgelaufen.' }, 409)
  }

  // --- rate limit (counts every request, also unreadable ones and failures) -----------------------
  const now = Date.now()
  await admin
    .from('grading_requests')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', new Date(now - 2 * DAY).toISOString())
  const { data: reqRow, error: reqError } = await admin
    .from('grading_requests')
    .insert({ user_id: userId })
    .select('id')
    .single()
  if (reqError || !reqRow) {
    console.error('grading_requests insert failed', reqError?.message)
    return json(
      { error: 'Die Korrektur ist gerade nicht verfügbar. Versuch es gleich noch einmal.' },
      503,
    )
  }
  const countSince = async (ms: number, ownOnly: boolean) => {
    let q = admin
      .from('grading_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(now - ms).toISOString())
    if (ownOnly) q = q.eq('user_id', userId)
    const { count, error } = await q
    if (error) console.error('grading_requests count failed', error.message)
    return error ? null : (count ?? 0)
  }
  const [minute, day, globalDay] = await Promise.all([
    countSince(MINUTE, true),
    countSince(DAY, true),
    countSince(DAY, false),
  ])
  // The limit must never be silently off: if counting fails, refuse instead of grading.
  if (minute === null || day === null || globalDay === null) {
    await admin.from('grading_requests').delete().eq('id', reqRow.id)
    return json(
      { error: 'Die Korrektur ist gerade nicht verfügbar. Versuch es gleich noch einmal.' },
      503,
    )
  }
  const exceeded = exceededLimit(
    { minute, day, globalDay },
    parseLimits((name) => Deno.env.get(name)),
  )
  if (exceeded) {
    await admin.from('grading_requests').delete().eq('id', reqRow.id) // rejected: does not count
    return json({ error: limitMessages[exceeded] }, 429, {
      'Retry-After': exceeded === 'minute' ? '60' : '3600',
    })
  }
  const setOutcome = (outcome: 'graded' | 'unreadable') =>
    admin.from('grading_requests').update({ outcome }).eq('id', reqRow.id)

  // --- exercise + reference solution (service role: solutions are not readable by students) -----
  const { data: exercise } = await admin
    .from('exercises')
    .select('id, subtopic_id, type, prompt, status')
    .eq('id', body.exerciseId)
    .eq('status', 'published')
    .maybeSingle()
  if (!exercise) return json({ error: 'Diese Aufgabe gibt es nicht.' }, 404)
  if (!(GRADABLE_TYPES as readonly string[]).includes(exercise.type)) {
    return json({ error: 'Diese Aufgabe wird nicht handschriftlich korrigiert.' }, 400)
  }
  const { data: solution } = await admin
    .from('exercise_solutions')
    .select('answer, solution')
    .eq('exercise_id', exercise.id)
    .single()
  if (!solution) return json({ error: 'Zu dieser Aufgabe fehlt die Musterlösung.' }, 500)

  // --- ask the model ----------------------------------------------------------------------------
  const prompt = buildPrompt({
    type: exercise.type,
    prompt: exercise.prompt,
    answer: solution.answer,
    solution: solution.solution,
    kind,
  })
  let feedback
  try {
    feedback = await gradeWithModel({
      provider,
      apiKey,
      model,
      system: prompt.system,
      user: prompt.user,
      image: { mime, base64: image },
    })
  } catch (e) {
    const err = e instanceof ProviderError ? e : null
    // Only kind/status – never bodies (they could contain the image or the student's work).
    console.error('grading failed', err?.kind ?? 'unknown', err?.status ?? '')
    if (err?.kind === 'timeout') {
      return json(
        {
          error:
            'Die Korrektur hat zu lange gedauert. Gib deine Lösung noch einmal ab – deine Eingabe bleibt erhalten.',
        },
        504,
      )
    }
    if (err?.kind === 'rate_limited') {
      return json(
        {
          error: 'Die Korrektur ist gerade ausgelastet. Warte einen Moment und gib noch einmal ab.',
        },
        503,
      )
    }
    return json(
      {
        error:
          'Die Korrektur ist gerade nicht verfügbar. Versuch es in ein paar Minuten noch einmal.',
      },
      502,
    )
  }

  const outcome = evaluateFeedback(feedback, { type: exercise.type, answer: solution.answer })

  // Unreadable: no attempt, no penalty; the hints already revealed stay as they are.
  if (outcome.status === 'unreadable') {
    await setOutcome('unreadable')
    return json({ status: 'unreadable', reason: outcome.reason })
  }

  // Exam: store the graded answer (1 / 0.5 for a correct result with a wrong step / 0) and reveal
  // nothing – correctness and solution come with finish_exam.
  if (examSessionId) {
    if ((await examOpen()) !== 'ok') {
      return json({ error: 'Die Prüfungszeit ist abgelaufen.' }, 409)
    }
    const points = outcome.correct ? 1 : outcome.final.verdict === 'correct' ? 0.5 : 0
    const { error } = await admin.from('exam_answers').upsert({
      session_id: examSessionId,
      exercise_id: exercise.id,
      user_id: userId,
      answer: { kind },
      correct: outcome.correct,
      points,
      feedback: { summary: outcome.summary, steps: outcome.steps, final: outcome.final, model },
      answered_at: new Date().toISOString(),
    })
    if (error) {
      console.error('exam answer insert failed', error.message)
      return json(
        { error: 'Deine Abgabe konnte nicht gespeichert werden. Gib sie noch einmal ab.' },
        500,
      )
    }
    await setOutcome('graded')
    return json({ status: 'saved' })
  }

  const insertError = await recordGradedAttempt(admin, {
    userId,
    exerciseId: exercise.id,
    subtopicId: exercise.subtopic_id,
    correct: outcome.correct,
    answer: { kind },
    feedback: {
      summary: outcome.summary,
      steps: outcome.steps,
      final: outcome.final,
      model,
    },
  })
  if (insertError) {
    console.error('attempt insert failed', insertError.message)
    return json(
      { error: 'Deine Abgabe konnte nicht gespeichert werden. Gib sie noch einmal ab.' },
      500,
    )
  }
  await setOutcome('graded')

  return json({
    status: 'graded',
    correct: outcome.correct,
    steps: outcome.steps,
    final: outcome.final,
    summary: outcome.summary,
    answer: solution.answer,
    solution: solution.solution,
  })
})
