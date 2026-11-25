import type { Database } from '@/types/database'
import { schoolTypeSchema, stateSchema } from '../curriculum/schema'
import {
  difficultySchema,
  exerciseTypeSchema,
  learningStageSchema,
  skillCategorySchema,
  videoFormatSchema,
  videoStatusSchema,
} from './enums'

type DbEnums = Database['public']['Enums']
type Values<S extends { options: readonly string[] }> = S['options'][number]
/** Resolves to `true` only if A and B are the same union. */
type Same<A, B> = [A, B] extends [B, A] ? true : false

// Compile-time checks: a mismatch between Zod and Postgres enums fails `tsc -b`.
const checks: true[] = [
  true satisfies Same<DbEnums['state_code'], Values<typeof stateSchema>>,
  true satisfies Same<DbEnums['school_type'], Values<typeof schoolTypeSchema>>,
  true satisfies Same<DbEnums['difficulty'], Values<typeof difficultySchema>>,
  true satisfies Same<DbEnums['exercise_type'], Values<typeof exerciseTypeSchema>>,
  true satisfies Same<DbEnums['learning_stage'], Values<typeof learningStageSchema>>,
  true satisfies Same<DbEnums['video_format'], Values<typeof videoFormatSchema>>,
  true satisfies Same<DbEnums['video_status'], Values<typeof videoStatusSchema>>,
  true satisfies Same<DbEnums['skill_category'], Values<typeof skillCategorySchema>>,
]

describe('content enums', () => {
  it('match the Postgres enums (checked by the compiler)', () => {
    expect(checks.every(Boolean)).toBe(true)
  })
})
