import { z } from 'zod'

// Shared content enums. Values must match the Postgres enums in supabase/migrations/
// (checked at compile time in src/features/curriculum/labels.test.ts).

export const difficultySchema = z.enum(['leicht', 'mittel', 'schwer', 'sehr_schwer'])
export type Difficulty = z.infer<typeof difficultySchema>

export const exerciseTypeSchema = z.enum([
  'multiple_choice',
  'numeric',
  'term',
  'matching',
  'cloze',
  'true_false',
  'ordering',
  'handwritten',
])
export type ExerciseType = z.infer<typeof exerciseTypeSchema>

/**
 * Learning progression of subtopics within a topic:
 * einstieg (terms, definitions) → grundlagen (standard procedure) →
 * vertiefung (special cases, combinations) → anwendung (word problems, real-world contexts).
 */
export const learningStageSchema = z.enum(['einstieg', 'grundlagen', 'vertiefung', 'anwendung'])
export type LearningStage = z.infer<typeof learningStageSchema>

export const videoFormatSchema = z.enum(['explainer', 'short'])
export type VideoFormat = z.infer<typeof videoFormatSchema>

export const videoStatusSchema = z.enum(['planned', 'produced', 'published'])
export type VideoStatus = z.infer<typeof videoStatusSchema>

/** Area of a basis skill (src/features/skills/schema.ts). */
export const skillCategorySchema = z.enum([
  'arithmetik',
  'algebra',
  'geometrie',
  'funktionen',
  'stochastik',
  'allgemein',
])
export type SkillCategory = z.infer<typeof skillCategorySchema>
