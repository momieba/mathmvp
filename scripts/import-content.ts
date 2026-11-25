/**
 * Imports curriculum and exercise drafts into Supabase (service role, bypasses RLS).
 *
 * Usage:
 *   npm run content:import -- --curriculum                         # all drafts/curriculum/*.json
 *   npm run content:import -- --skills                             # all drafts/skills/*.json (after curriculum)
 *   npm run content:import -- --exercises <file.json> [...] [--publish]
 *   add --dry-run to validate and print what would happen
 *
 * Exercises must have been approved (FREIGEGEBEN) by math-checker before importing.
 * Without --publish they are imported with status "review".
 * Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (never commit the key).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { curriculumDraftSchema, type Topic } from '../src/features/curriculum/schema'
import { buildPresentation } from '../src/features/exercises/presentation'
import { exerciseDraftFileSchema, type Exercise } from '../src/features/exercises/schema'
import { skillCatalogSchema, type Skill } from '../src/features/skills/schema'
import type { Database, Json } from '../src/types/database'

// --- args & env ----------------------------------------------------------------------------
const args = process.argv.slice(2)
const has = (f: string) => args.includes(f)
const dryRun = has('--dry-run')
const publish = has('--publish')
const exerciseFiles = args.filter((a) => a.endsWith('.json'))
if (!has('--curriculum') && !has('--skills') && exerciseFiles.length === 0) {
  console.error(
    'Usage: npm run content:import -- [--curriculum] [--skills] [--exercises <file.json> ...] [--publish] [--dry-run]',
  )
  process.exit(1)
}

function loadEnv(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((l) => /^[A-Z0-9_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
    )
  } catch {
    return {}
  }
}
const env = { ...loadEnv('.env.local'), ...process.env }
const url = env.VITE_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!dryRun && (!url || !serviceKey)) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const db = dryRun
  ? null
  : createClient<Database>(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

/** Throws on error; returns the rows (an empty list for writes without .select()). */
function check<T>(
  label: string,
  res: { data: T; error: { message: string } | null },
): NonNullable<T> {
  if (res.error) throw new Error(`${label}: ${res.error.message}`)
  return (res.data ?? []) as NonNullable<T>
}

function readJson<S extends z.ZodType>(file: string, schema: S): z.infer<S> {
  const result = schema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
  if (!result.success) throw new Error(`${file} is invalid:\n${z.prettifyError(result.error)}`)
  return result.data
}

// --- curriculum ----------------------------------------------------------------------------
async function importCurriculum() {
  const dir = join('drafts', 'curriculum')
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  const topics: Topic[] = files.flatMap((f) => readJson(join(dir, f), curriculumDraftSchema).topics)
  const subtopicCount = topics.reduce((n, t) => n + t.subtopics.length, 0)
  console.log(
    `curriculum: ${files.length} files, ${topics.length} topics, ${subtopicCount} subtopics`,
  )
  if (!db) return

  for (const [ti, topic] of topics.entries()) {
    const [row] = check(
      `topic ${topic.slug}`,
      await db
        .from('topics')
        .upsert(
          { slug: topic.slug, title: topic.title, description: topic.description, sort_order: ti },
          { onConflict: 'slug' },
        )
        .select('id'),
    )
    for (const [si, s] of topic.subtopics.entries()) {
      const [sub] = check(
        `subtopic ${s.slug}`,
        await db
          .from('subtopics')
          .upsert(
            {
              topic_id: row!.id,
              slug: s.slug,
              title: s.title,
              description: s.description,
              stage: s.stage,
              sort_order: si,
              learning_goals: s.learningGoals,
              exercise_plan: s.exercisePlan as unknown as Json,
              video_skip_reason: s.videoSkipReason ?? null,
            },
            { onConflict: 'slug' },
          )
          .select('id'),
      )
      check(
        'delete placements',
        await db.from('subtopic_placements').delete().eq('subtopic_id', sub!.id),
      )
      check(
        `placements ${s.slug}`,
        await db.from('subtopic_placements').insert(
          s.placements.map((p) => ({
            subtopic_id: sub!.id,
            state: p.state,
            school_type: p.schoolType,
            grade: p.grade,
            source: p.source,
          })),
        ),
      )
      const existing = check(
        'videos',
        await db.from('videos').select('format, title').eq('subtopic_id', sub!.id),
      )
      const missing = s.videos.filter(
        (v) => !existing.some((e) => e.format === v.format && e.title === v.title),
      )
      if (missing.length) {
        check(
          `videos ${s.slug}`,
          await db.from('videos').insert(
            missing.map((v, i) => ({
              subtopic_id: sub!.id,
              format: v.format,
              title: v.title,
              key_points: v.keyPoints,
              sort_order: existing.length + i,
            })),
          ),
        )
      }
    }
  }

  // Prerequisites last, so references across topics/files resolve.
  const ids = new Map(
    check('subtopic ids', await db.from('subtopics').select('id, slug')).map((s) => [s.slug, s.id]),
  )
  const unresolved = new Set<string>()
  for (const s of topics.flatMap((t) => t.subtopics)) {
    const id = ids.get(s.slug)!
    check(
      'delete prerequisites',
      await db.from('subtopic_prerequisites').delete().eq('subtopic_id', id),
    )
    const rows = s.prerequisites.flatMap((p) => {
      const pid = ids.get(p)
      if (!pid) unresolved.add(p)
      return pid ? [{ subtopic_id: id, prerequisite_id: pid }] : []
    })
    if (rows.length)
      check(`prerequisites ${s.slug}`, await db.from('subtopic_prerequisites').insert(rows))
  }
  if (unresolved.size) {
    console.warn(`prerequisites not found (yet): ${[...unresolved].sort().join(', ')}`)
  }
  console.log('curriculum imported')
}

// --- skills --------------------------------------------------------------------------------
async function importSkills() {
  const dir = join('drafts', 'skills')
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
  const skills: Skill[] = files.flatMap((f) => readJson(join(dir, f), skillCatalogSchema).skills)
  const dupes = skills.map((s) => s.slug).filter((s, i, all) => all.indexOf(s) !== i)
  if (dupes.length) throw new Error(`skill slugs defined twice: ${[...new Set(dupes)].join(', ')}`)
  const slugs = new Set(skills.map((s) => s.slug))
  const orphans = skills.filter((s) => s.parent && !slugs.has(s.parent))
  if (orphans.length)
    throw new Error(`unknown parents: ${orphans.map((s) => `${s.slug} → ${s.parent}`).join(', ')}`)
  console.log(`skills: ${files.length} files, ${skills.length} skills`)
  if (!db) return

  // Skills never get deleted here (student data will refer to them) – removed ones stay.
  const rows = check(
    'skills',
    await db
      .from('skills')
      .upsert(
        skills.map((s, i) => ({
          slug: s.slug,
          title: s.title,
          description: s.description,
          category: s.category,
          grade_from: s.gradeFrom,
          sort_order: i,
        })),
        { onConflict: 'slug' },
      )
      .select('id, slug'),
  )
  const skillId = new Map(rows.map((r) => [r.slug, r.id]))
  for (const s of skills) {
    check(
      `parent ${s.slug}`,
      await db
        .from('skills')
        .update({ parent_id: s.parent ? skillId.get(s.parent)! : null })
        .eq('id', skillId.get(s.slug)!),
    )
  }

  const subtopicId = new Map(
    check('subtopic ids', await db.from('subtopics').select('id, slug')).map((s) => [s.slug, s.id]),
  )
  const unresolved = new Set<string>()
  for (const s of skills) {
    const id = skillId.get(s.slug)!
    check('delete homes', await db.from('skill_home_subtopics').delete().eq('skill_id', id))
    const homes = s.homeSubtopics.flatMap((slug) => {
      const sid = subtopicId.get(slug)
      if (!sid) unresolved.add(slug)
      return sid ? [{ skill_id: id, subtopic_id: sid }] : []
    })
    if (homes.length) check(`homes ${s.slug}`, await db.from('skill_home_subtopics').insert(homes))
  }
  if (unresolved.size) {
    console.warn(`home subtopics not found (yet): ${[...unresolved].sort().join(', ')}`)
  }
  console.log('skills imported')
}

// --- exercises -----------------------------------------------------------------------------
async function importExercises(file: string) {
  const exercises: Exercise[] = readJson(file, exerciseDraftFileSchema).exercises
  const status = publish ? 'published' : 'review'
  console.log(`${file}: ${exercises.length} exercises → status "${status}"`)
  if (!db) return

  const slugs = [...new Set(exercises.map((e) => e.subtopic))]
  const subtopics = check(
    'subtopics',
    await db.from('subtopics').select('id, slug').in('slug', slugs),
  )
  const subtopicId = new Map(subtopics.map((s) => [s.slug, s.id]))
  const missing = slugs.filter((s) => !subtopicId.has(s))
  if (missing.length)
    throw new Error(`unknown subtopics (import curriculum first): ${missing.join(', ')}`)

  for (const e of exercises) {
    const [row] = check(
      `exercise ${e.key}`,
      await db
        .from('exercises')
        .upsert(
          {
            key: e.key,
            subtopic_id: subtopicId.get(e.subtopic)!,
            type: e.type,
            status,
            prompt: e.prompt,
            diagram: (e.diagram ?? null) as Json,
            presentation: buildPresentation(e) as Json,
            inspiration: e.inspiration,
          },
          { onConflict: 'key' },
        )
        .select('id'),
    )
    check(
      `solution ${e.key}`,
      await db.from('exercise_solutions').upsert({
        exercise_id: row!.id,
        answer: e.answer as unknown as Json,
        solution: e.solution as unknown as Json,
        hints: (e.hints ?? []) as Json,
      }),
    )
    check(
      'delete exercise placements',
      await db.from('exercise_placements').delete().eq('exercise_id', row!.id),
    )
    check(
      `placements ${e.key}`,
      await db.from('exercise_placements').insert(
        e.placements.map((p) => ({
          exercise_id: row!.id,
          state: p.state,
          school_type: p.schoolType,
          grade: p.grade,
          difficulty: p.difficulty,
        })),
      ),
    )
  }
  console.log(`${file}: imported`)
}

if (has('--curriculum')) await importCurriculum()
if (has('--skills')) await importSkills()
for (const f of exerciseFiles) await importExercises(f)
if (dryRun) console.log('dry run – nothing written')
