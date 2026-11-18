import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(
      `Invalid environment variables (see .env.example): ${z.prettifyError(result.error)}`,
    )
  }
  return result.data
}

export const env = parseEnv(import.meta.env)
