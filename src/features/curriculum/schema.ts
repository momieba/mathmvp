import { z } from 'zod'

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

/** Where a subtopic is taught: one row per (state, school type, grade). */
export const placementKeySchema = z.object({
  state: stateSchema,
  schoolType: schoolTypeSchema,
  grade: gradeSchema,
})
export type PlacementKey = z.infer<typeof placementKeySchema>

export const subtopicSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
})

export const topicSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  subtopics: z.array(subtopicSchema).min(1),
})

export const curriculumPlacementSchema = placementKeySchema.extend({
  subtopic: slugSchema,
  /** Official source (URL + document/section) the placement is based on. */
  source: z.string().min(1),
})

/** Output format of the curriculum-researcher agent (drafts/curriculum/*.json). */
export const curriculumDraftSchema = z
  .object({
    topics: z.array(topicSchema).min(1),
    placements: z.array(curriculumPlacementSchema),
  })
  .superRefine((draft, ctx) => {
    const known = new Set(draft.topics.flatMap((t) => t.subtopics.map((s) => s.slug)))
    draft.placements.forEach((p, i) => {
      if (!known.has(p.subtopic)) {
        ctx.addIssue({
          code: 'custom',
          path: ['placements', i, 'subtopic'],
          message: `unknown subtopic "${p.subtopic}"`,
        })
      }
    })
  })
export type CurriculumDraft = z.infer<typeof curriculumDraftSchema>
