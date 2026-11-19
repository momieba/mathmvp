// Grades a handwritten solution (PNG from the drawing canvas) with Gemini against the reference
// solution, records the attempt and returns feedback + the model solution.
// The image is only forwarded to Gemini and never stored.
//
// Secrets (Supabase → Edge Functions → Secrets): GEMINI_API_KEY, optional GEMINI_MODEL.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the runtime.
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'
const MAX_IMAGE_BYTES = 2_000_000 // base64 length limit (~1.5 MB PNG)
const MAX_GRADINGS_PER_MINUTE = 6

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

type Feedback = {
  correct: boolean
  readable: boolean
  summary: string
  errors: { step: string; explanation: string }[]
}

const feedbackSchema = {
  type: 'OBJECT',
  properties: {
    readable: {
      type: 'BOOLEAN',
      description: 'false if the handwriting cannot be read or the image is empty/off-topic',
    },
    correct: {
      type: 'BOOLEAN',
      description: 'true only if the final result is correct and the way is mathematically sound',
    },
    summary: {
      type: 'STRING',
      description: 'One or two encouraging sentences in German (Du-Form)',
    },
    errors: {
      type: 'ARRAY',
      description: 'Each concrete mistake, in the order it occurs. Empty if correct.',
      items: {
        type: 'OBJECT',
        properties: {
          step: {
            type: 'STRING',
            description: 'What the student wrote at that point (short, may contain LaTeX in $…$)',
          },
          explanation: {
            type: 'STRING',
            description:
              'What is wrong and how to fix it, in German, Du-Form, without simply giving the full solution',
          },
        },
        required: ['step', 'explanation'],
      },
    },
  },
  required: ['readable', 'correct', 'summary', 'errors'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'GEMINI_API_KEY is not configured' }, 500)

  // --- who is calling? (JWT verified by the platform; resolve the user from it) ---------------
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
    },
  )
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'not authenticated' }, 401)
  const userId = userData.user.id

  // --- input ------------------------------------------------------------------------------------
  let body: { exerciseId?: string; image?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON' }, 400)
  }
  const image = (body.image ?? '').replace(/^data:image\/png;base64,/, '')
  if (!body.exerciseId || !image) return json({ error: 'exerciseId and image are required' }, 400)
  if (image.length > MAX_IMAGE_BYTES) return json({ error: 'image too large' }, 413)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false },
    },
  )

  // --- simple per-user rate limit (protects the Gemini quota) -----------------------------------
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await admin
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('feedback', 'is', null)
    .gte('created_at', since)
  if ((count ?? 0) >= MAX_GRADINGS_PER_MINUTE) {
    return json(
      {
        error: 'Zu viele Korrekturen in kurzer Zeit – warte kurz und versuch es dann noch einmal.',
      },
      429,
    )
  }

  // --- exercise + reference solution (service role: solutions are not readable by students) -----
  const { data: exercise } = await admin
    .from('exercises')
    .select('id, subtopic_id, type, prompt, status')
    .eq('id', body.exerciseId)
    .eq('status', 'published')
    .maybeSingle()
  if (!exercise) return json({ error: 'exercise not found' }, 404)
  const { data: solution } = await admin
    .from('exercise_solutions')
    .select('answer, solution')
    .eq('exercise_id', exercise.id)
    .single()
  if (!solution) return json({ error: 'solution missing' }, 500)

  // --- ask Gemini -------------------------------------------------------------------------------
  const instructions = [
    'Du bist eine freundliche, genaue Mathe-Nachhilfelehrkraft für Schülerinnen und Schüler (Klasse 5–13).',
    'Auf dem Bild steht die handschriftliche Lösung einer Schülerin oder eines Schülers zu der folgenden Aufgabe.',
    'Vergleiche sie mit der Musterlösung. Akzeptiere auch andere richtige Lösungswege und gleichwertige Schreibweisen',
    '(Komma statt Punkt, gekürzte/ungekürzte Brüche, sinnvolle Rundung). Bewerte nur, was wirklich auf dem Bild steht – erfinde nichts.',
    'Nenne jeden konkreten Fehler mit der Stelle, an der er passiert, und erkläre kurz, wie man ihn vermeidet.',
    'Wenn das Bild leer, unleserlich oder themenfremd ist: readable = false, correct = false.',
    'Schreibe auf Deutsch in Du-Form, ermutigend, ohne die komplette Lösung vorzurechnen. Mathe in $…$ (LaTeX).',
    '',
    `AUFGABE:\n${exercise.prompt}`,
    '',
    `ERWARTETE ANTWORT (intern, JSON):\n${JSON.stringify(solution.answer)}`,
    '',
    `MUSTERLÖSUNG (intern, JSON):\n${JSON.stringify(solution.solution)}`,
  ].join('\n')

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: instructions },
              { inline_data: { mime_type: 'image/png', data: image } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: feedbackSchema,
          temperature: 0.2,
        },
      }),
    },
  )
  if (!geminiRes.ok) {
    console.error('gemini error', geminiRes.status, await geminiRes.text())
    return json(
      { error: 'Die Korrektur ist gerade nicht verfügbar. Bitte versuch es später noch einmal.' },
      502,
    )
  }
  const geminiJson = await geminiRes.json()
  let feedback: Feedback
  try {
    feedback = JSON.parse(geminiJson.candidates[0].content.parts[0].text) as Feedback
  } catch {
    console.error('unexpected gemini response', JSON.stringify(geminiJson).slice(0, 500))
    return json({ error: 'Die Korrektur konnte nicht ausgewertet werden.' }, 502)
  }

  // Unreadable images do not count as an attempt (no penalty for a bad photo/drawing).
  if (feedback.readable) {
    const { error: insertError } = await admin.from('attempts').insert({
      user_id: userId,
      exercise_id: exercise.id,
      subtopic_id: exercise.subtopic_id,
      correct: feedback.correct === true,
      answer: { kind: 'handwritten' },
      feedback: { ...feedback, model: MODEL },
    })
    if (insertError) console.error('attempt insert failed', insertError.message)
  }

  return json({
    readable: feedback.readable,
    correct: feedback.readable && feedback.correct === true,
    summary: feedback.summary,
    errors: feedback.errors ?? [],
    answer: solution.answer,
    solution: solution.solution,
  })
})
