import { z } from 'zod'
import {
  difficultySchema,
  exerciseTypeSchema,
  learningStageSchema,
  videoFormatSchema,
} from '../content/enums'

/** ISO 3166-2:DE subdivision codes without the "DE-" prefix. */
export const stateSchema = z.enum([
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
]) // prettier-ignore
export type State = z.infer<typeof stateSchema>

export const schoolTypeSchema = z.enum([
  'gymnasium',
  'realschule',
  'gesamtschule',
  'hauptschule',
  'mittelschule',
  'oberschule',
  'sekundarschule',
  'stadtteilschule',
])
export type SchoolType = z.infer<typeof schoolTypeSchema>

export const gradeSchema = z.int().min(5).max(13)

/** kebab-case ASCII identifier, stable across regenerations (used for upserts). */
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be kebab-case ASCII')

/** A (state, school type, grade) tuple. */
export const placementKeySchema = z.object({
  state: stateSchema,
  schoolType: schoolTypeSchema,
  grade: gradeSchema,
})
export type PlacementKey = z.infer<typeof placementKeySchema>

/** Where a subtopic is taught, with the official source it is based on. */
export const curriculumPlacementSchema = placementKeySchema.extend({
  /** Official source (URL + document/section). */
  source: z.string().min(1),
})

/** A planned video for a subtopic (becomes a row in `videos` with status "planned"). */
export const videoPlanSchema = z.object({
  format: videoFormatSchema,
  title: z.string().min(1),
  /** What the video must explain, in order. */
  keyPoints: z.array(z.string().min(1)).min(1),
})
export type VideoPlan = z.infer<typeof videoPlanSchema>

/** Minimum exercises per subtopic – practising should feel endless. */
export const MIN_EXERCISES_PER_SUBTOPIC = 20

/** Brief for the exercise-author agent. */
export const exercisePlanSchema = z
  .object({
    targetCount: z.int().min(MIN_EXERCISES_PER_SUBTOPIC),
    types: z.array(exerciseTypeSchema).min(1),
    /** Share per difficulty in percent; must add up to 100. */
    difficultyMix: z.partialRecord(difficultySchema, z.int().min(0).max(100)),
    /** Variation ideas (contexts, number ranges, representations) to keep exercises fresh. */
    variationIdeas: z.array(z.string().min(1)).optional(),
  })
  .refine((p) => Object.values(p.difficultyMix).reduce((a, b) => a + (b ?? 0), 0) === 100, {
    message: 'difficultyMix must add up to 100',
    path: ['difficultyMix'],
  })
export type ExercisePlan = z.infer<typeof exercisePlanSchema>

export const subtopicSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  stage: learningStageSchema,
  /** "Ich kann …" statements, student perspective. */
  learningGoals: z.array(z.string().min(1)).min(1),
  /** Subtopic slugs (this or other topics) that should be mastered first. */
  prerequisites: z.array(slugSchema).default([]),
  placements: z.array(curriculumPlacementSchema).min(1),
  /** Usually at least one; an empty list needs `videoSkipReason`. */
  videos: z.array(videoPlanSchema).default([]),
  videoSkipReason: z.string().min(1).optional(),
  exercisePlan: exercisePlanSchema,
})
export type Subtopic = z.infer<typeof subtopicSchema>

const stageRank = Object.fromEntries(learningStageSchema.options.map((s, i) => [s, i]))

export const topicSchema = z
  .object({
    slug: slugSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    /** Subtopics in learning order (array index = sort order). */
    subtopics: z.array(subtopicSchema).min(1),
  })
  .superRefine((topic, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path })

    topic.subtopics.forEach((s, i) => {
      const prev = topic.subtopics[i - 1]
      if (prev && stageRank[s.stage]! < stageRank[prev.stage]!) {
        issue(`stage "${s.stage}" must not come after "${prev.stage}"`, ['subtopics', i, 'stage'])
      }
      if (s.videos.length === 0 && !s.videoSkipReason) {
        issue('no videos planned – add one or give videoSkipReason', ['subtopics', i, 'videos'])
      }
      const seen = new Set<string>()
      s.placements.forEach((p, j) => {
        const k = `${p.state}/${p.schoolType}/${p.grade}`
        if (seen.has(k)) issue(`duplicate placement ${k}`, ['subtopics', i, 'placements', j])
        seen.add(k)
      })
      // A prerequisite inside the same topic must come earlier in the learning order.
      const later = new Set(topic.subtopics.slice(i).map((x) => x.slug))
      s.prerequisites.forEach((pre, j) => {
        if (later.has(pre)) {
          issue(`prerequisite "${pre}" must come before "${s.slug}"`, [
            'subtopics',
            i,
            'prerequisites',
            j,
          ])
        }
      })
    })
  })
export type Topic = z.infer<typeof topicSchema>

/** Output format of the curriculum-researcher agent (drafts/curriculum/*.json). */
export const curriculumDraftSchema = z
  .object({ topics: z.array(topicSchema).min(1) })
  .superRefine((draft, ctx) => {
    const slugs = new Set<string>()
    draft.topics.forEach((t, i) => {
      for (const [path, slug] of [
        [['topics', i, 'slug'], t.slug] as const,
        ...t.subtopics.map((s, j) => [['topics', i, 'subtopics', j, 'slug'], s.slug] as const),
      ]) {
        if (slugs.has(slug))
          ctx.addIssue({ code: 'custom', message: `duplicate slug ${slug}`, path: [...path] })
        slugs.add(slug)
      }
    })
  })
export type CurriculumDraft = z.infer<typeof curriculumDraftSchema>
