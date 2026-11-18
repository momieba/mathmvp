import { z } from 'zod'
import { difficultySchema, type ExerciseType } from '../content/enums'
import { placementKeySchema, slugSchema } from '../curriculum/schema'

export {
  difficultySchema,
  exerciseTypeSchema,
  type Difficulty,
  type ExerciseType,
} from '../content/enums'

/**
 * Text fields are Markdown with inline LaTeX in `$…$` and display LaTeX in `$$…$$` (rendered via KaTeX).
 */
const richText = z.string().min(1)

/** Difficulty is relative to the placement: the same exercise can be "schwer" in grade 8 and "leicht" in grade 10. */
export const exercisePlacementSchema = placementKeySchema.extend({ difficulty: difficultySchema })

// --- Diagrams are stored as data, not images, so they stay editable and render crisply. ---

const pointSchema = z.tuple([z.number(), z.number()])
const rangeSchema = z.tuple([z.number(), z.number()])

export const diagramSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('function_plot'),
    xRange: rangeSchema,
    yRange: rangeSchema,
    /** Expressions in mathjs syntax, e.g. "0.5*x^2 - 3". */
    functions: z.array(z.object({ expr: z.string().min(1), label: z.string().optional() })).min(1),
    points: z.array(z.object({ at: pointSchema, label: z.string().optional() })).optional(),
  }),
  z.object({
    kind: z.literal('geometry'),
    points: z.record(z.string(), pointSchema),
    segments: z.array(z.tuple([z.string(), z.string()])).optional(),
    polygons: z.array(z.array(z.string()).min(3)).optional(),
    circles: z.array(z.object({ center: z.string(), radius: z.number().positive() })).optional(),
    labels: z.array(z.object({ at: pointSchema, text: z.string() })).optional(),
    /** Right-angle markers, given as the vertex name of the angle. */
    rightAngles: z.array(z.string()).optional(),
  }),
  z.object({
    kind: z.literal('table'),
    header: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
])
export type Diagram = z.infer<typeof diagramSchema>

// --- Answer formats per exercise type ---

const answerSchemas = {
  multiple_choice: z.object({
    options: z.array(richText).min(2).max(6),
    /** Indices into `options`; more than one allows multi-select. */
    correct: z.array(z.int().nonnegative()).min(1),
  }),
  numeric: z.object({
    value: z.number(),
    tolerance: z.number().nonnegative().default(0),
    unit: z.string().optional(),
  }),
  term: z.object({
    /** Reference solution in mathjs syntax; checked for equivalence, not string equality. */
    expression: z.string().min(1),
    variables: z.array(z.string().min(1)).min(1),
  }),
  matching: z.object({
    left: z.array(richText).min(2),
    right: z.array(richText).min(2),
    /** Pairs of [leftIndex, rightIndex]. */
    pairs: z.array(z.tuple([z.int().nonnegative(), z.int().nonnegative()])).min(1),
  }),
  cloze: z.object({
    /** One entry per gap marker `{{1}}`, `{{2}}`, … in the prompt. */
    gaps: z.array(z.object({ accepted: z.array(z.string().min(1)).min(1) })).min(1),
  }),
  true_false: z.object({
    statements: z.array(z.object({ text: richText, correct: z.boolean() })).min(1),
  }),
  ordering: z.object({
    /** Items in the correct order; the app shuffles them. */
    items: z.array(richText).min(2),
  }),
  handwritten: z.object({
    /** Self-check criteria shown next to the model solution. */
    rubric: z.array(richText).min(1),
  }),
  // `satisfies` + excess-property check: exactly one answer schema per exercise type.
} as const satisfies Record<ExerciseType, z.ZodType>

const solutionSchema = z.object({
  steps: z.array(z.object({ text: richText, diagram: diagramSchema.optional() })).min(1),
  /** Short final result as shown to the student. */
  result: richText,
})

const baseExerciseSchema = z.object({
  /** Stable key for upserts, e.g. "pythagoras-hypotenuse-berechnen-003". */
  key: slugSchema,
  subtopic: slugSchema,
  placements: z.array(exercisePlacementSchema).min(1),
  prompt: richText,
  diagram: diagramSchema.optional(),
  hints: z.array(richText).optional(),
  solution: solutionSchema,
  /**
   * Copyright trail: which kind of textbook exercise served as a model and what was changed.
   * Never a verbatim copy — see .claude/agents/exercise-author.md.
   */
  inspiration: z.string().min(1),
})

const variant = <T extends ExerciseType>(type: T) =>
  baseExerciseSchema.extend({ type: z.literal(type), answer: answerSchemas[type] })

export const exerciseSchema = z
  .discriminatedUnion('type', [
    variant('multiple_choice'),
    variant('numeric'),
    variant('term'),
    variant('matching'),
    variant('cloze'),
    variant('true_false'),
    variant('ordering'),
    variant('handwritten'),
  ])
  .superRefine((ex, ctx) => {
    const issue = (message: string, path: (string | number)[] = ['answer']) =>
      ctx.addIssue({ code: 'custom', message, path })

    switch (ex.type) {
      case 'multiple_choice':
        if (ex.answer.correct.some((i) => i >= ex.answer.options.length))
          issue('correct index out of range')
        break
      case 'matching':
        if (
          ex.answer.pairs.some(
            ([l, r]) => l >= ex.answer.left.length || r >= ex.answer.right.length,
          )
        )
          issue('pair index out of range')
        break
      case 'cloze': {
        const markers = new Set([...ex.prompt.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]))
        if (markers.size !== ex.answer.gaps.length)
          issue(
            `prompt has ${markers.size} gap markers but answer has ${ex.answer.gaps.length} gaps`,
          )
        break
      }
    }

    const seen = new Set<string>()
    ex.placements.forEach((p, i) => {
      const k = `${p.state}/${p.schoolType}/${p.grade}`
      if (seen.has(k)) issue(`duplicate placement ${k}`, ['placements', i])
      seen.add(k)
    })
  })
export type Exercise = z.infer<typeof exerciseSchema>

/** Output format of the exercise-author agent (drafts/exercises/*.json). */
export const exerciseDraftFileSchema = z
  .object({ exercises: z.array(exerciseSchema).min(1) })
  .superRefine((file, ctx) => {
    const keys = new Set<string>()
    file.exercises.forEach((ex, i) => {
      if (keys.has(ex.key))
        ctx.addIssue({ code: 'custom', message: `duplicate key ${ex.key}`, path: ['exercises', i] })
      keys.add(ex.key)
    })
  })
export type ExerciseDraftFile = z.infer<typeof exerciseDraftFileSchema>
