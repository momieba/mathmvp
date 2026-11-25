import { z } from 'zod'
import { skillCategorySchema } from '../content/enums'
import { slugSchema } from '../curriculum/schema'

export { skillCategorySchema, type SkillCategory } from '../content/enums'

/**
 * A basis skill: a cross-cutting ability needed in many subtopics (fractions, signs, rearranging
 * equations …). Subtopics themselves are the topic skills and are not listed here.
 * Single source for the catalog format (drafts/skills/*.json, import, agents).
 */
export const skillSchema = z.object({
  /** kebab-case ASCII, stable – exercises and student data refer to it. */
  slug: slugSchema,
  /** Short name in German, e.g. "Brüche addieren und subtrahieren". */
  title: z.string().min(1),
  /** One sentence: what the skill covers. Also shown to the grading model. */
  description: z.string().min(1),
  category: skillCategorySchema,
  /** Grade from which the skill is typically expected (5–13). */
  gradeFrom: z.int().min(5).max(13),
  /** Subtopic slugs where the skill is taught – target of review suggestions. At least one. */
  homeSubtopics: z.array(slugSchema).min(1),
  /** Optional grouping skill, e.g. "bruchrechnung" for "brueche-addieren". */
  parent: slugSchema.optional(),
})
export type Skill = z.infer<typeof skillSchema>

export const skillCatalogSchema = z
  .object({ skills: z.array(skillSchema).min(1) })
  .superRefine(({ skills }, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path })
    const bySlug = new Map<string, Skill>()
    skills.forEach((s, i) => {
      if (bySlug.has(s.slug)) issue(`duplicate skill slug "${s.slug}"`, ['skills', i, 'slug'])
      bySlug.set(s.slug, s)
      if (new Set(s.homeSubtopics).size !== s.homeSubtopics.length)
        issue('duplicate home subtopic', ['skills', i, 'homeSubtopics'])
    })
    skills.forEach((s, i) => {
      if (s.parent === undefined) return
      if (!bySlug.has(s.parent)) {
        issue(`unknown parent "${s.parent}"`, ['skills', i, 'parent'])
        return
      }
      // Walk up the parent chain; coming back to the start means a cycle.
      const seen = new Set([s.slug])
      for (let p: string | undefined = s.parent; p !== undefined; p = bySlug.get(p)?.parent) {
        if (seen.has(p)) {
          issue(`parent cycle at "${s.slug}"`, ['skills', i, 'parent'])
          break
        }
        seen.add(p)
      }
    })
  })
export type SkillCatalog = z.infer<typeof skillCatalogSchema>
