import { z } from 'zod'
import { difficultySchema } from '../../content/enums'
import { placementKeySchema, slugSchema } from '../../curriculum/schema'

/**
 * Exercise templates: declarative JSON from which scripts/generate-exercises.ts produces ordinary
 * exercise drafts (drafts/exercises/*.json). Agents write templates; no agent-written code runs.
 *
 * Expressions use mathjs syntax and are evaluated with the sampled parameters in scope.
 * Text templates contain placeholders `{{expr}}` or `{{expr:decimals}}`; numbers are formatted
 * with a German decimal comma (inside `$…$` as `{,}` for correct LaTeX spacing).
 */

const expr = z.string().min(1)
const text = z.string().min(1)

/** A parameter is drawn from a list of values or from a range (inclusive, with step). */
export const paramSpecSchema = z.union([
  z.object({ values: z.array(z.number()).min(1) }),
  z
    .object({ min: z.number(), max: z.number(), step: z.number().positive() })
    .refine((r) => r.max >= r.min, 'max must be >= min'),
])

const numericAnswer = z.object({
  type: z.literal('numeric'),
  value: expr,
  tolerance: expr.default('0'),
  unit: z.string().optional(),
})

const multipleChoiceAnswer = z.object({
  type: z.literal('multiple_choice'),
  /** Text template of the correct option. */
  correct: text,
  /** Text templates of wrong options – ideally typical mistakes (e.g. forgetting the root). */
  distractors: z.array(text).min(1).max(5),
})

const handwrittenAnswer = z.object({
  type: z.literal('handwritten'),
  /**
   * Grading criteria (text templates, e.g. "Lösungspaar $(x\\,|\\,y) = ({{x}}\\,|\\,{{y}})$"). The expected
   * result goes into `solution.result`; the edge function grades against rubric + model solution.
   */
  rubric: z.array(text).min(1),
})

export const templateAnswerSchema = z.discriminatedUnion('type', [
  numericAnswer,
  multipleChoiceAnswer,
  handwrittenAnswer,
])

/** Phrasing variant of a level; contexts are used round-robin for variety. */
export const templateContextSchema = z.object({
  id: slugSchema,
  prompt: text,
  /**
   * Diagram template (see diagramSchema). Strings that consist of exactly one placeholder
   * become numbers ("{{a/2}}" → 2.5); other strings are rendered as text.
   */
  diagram: z.unknown().optional(),
})

export const templateLevelSchema = z.object({
  id: slugSchema,
  difficulty: difficultySchema,
  count: z.int().min(1),
  /** Merged over the template-level params/derived (level wins). Derived values are evaluated in key order. */
  params: z.record(z.string(), paramSpecSchema).default({}),
  derived: z.record(z.string(), expr).default({}),
  /** Samples violating a constraint are discarded and redrawn. */
  constraints: z.array(expr).default([]),
  /** Optional dedupe key expression, e.g. "sort([a, b])" when swapped values are the same exercise. */
  uniqueBy: expr.optional(),
  contexts: z.array(templateContextSchema).min(1),
  answer: templateAnswerSchema,
  solution: z.object({ steps: z.array(text).min(1), result: text }),
  hints: z.array(text).optional(),
})

export const exerciseTemplateSchema = z.object({
  id: slugSchema,
  subtopic: slugSchema,
  /** Every generated exercise gets these placements with the level's difficulty. */
  placements: z.array(placementKeySchema).min(1),
  params: z.record(z.string(), paramSpecSchema).default({}),
  derived: z.record(z.string(), expr).default({}),
  constraints: z.array(expr).default([]),
  uniqueBy: expr.optional(),
  /**
   * Self-checks that must hold for every generated exercise (e.g. the answer satisfies the
   * equation). A failing check is a template bug → generation aborts.
   */
  checks: z.array(expr).min(1),
  levels: z.array(templateLevelSchema).min(1),
})
export type ExerciseTemplate = z.infer<typeof exerciseTemplateSchema>
export type TemplateLevel = z.infer<typeof templateLevelSchema>
