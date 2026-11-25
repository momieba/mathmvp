/**
 * Validates draft JSON files against the shared Zod schemas.
 * Usage: npm run drafts:validate [-- <file-or-dir> ...]   (default: drafts/)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { z } from 'zod'
import { curriculumDraftSchema } from '../src/features/curriculum/schema'
import { exerciseDraftFileSchema } from '../src/features/exercises/schema'
import { skillCatalogSchema } from '../src/features/skills/schema'

function collect(path: string): string[] {
  if (statSync(path).isDirectory()) return readdirSync(path).flatMap((f) => collect(join(path, f)))
  return path.endsWith('.json') ? [path] : []
}

function schemaFor(file: string) {
  if (file.includes(`${sep}curriculum${sep}`) || file.includes('/curriculum/'))
    return curriculumDraftSchema
  if (file.includes(`${sep}exercises${sep}`) || file.includes('/exercises/'))
    return exerciseDraftFileSchema
  if (file.includes(`${sep}skills${sep}`) || file.includes('/skills/')) return skillCatalogSchema
  return null
}

const targets = process.argv.slice(2)
const files = (targets.length ? targets : ['drafts']).flatMap(collect)
let failed = 0

for (const file of files) {
  const schema = schemaFor(file)
  if (!schema) {
    console.warn(`SKIP  ${file} (not under curriculum/, exercises/ or skills/)`)
    continue
  }
  let data: unknown
  try {
    data = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    failed++
    console.error(`FAIL  ${file}\n  invalid JSON: ${(e as Error).message}`)
    continue
  }
  const result = schema.safeParse(data)
  if (result.success) console.log(`OK    ${file}`)
  else {
    failed++
    console.error(`FAIL  ${file}\n${z.prettifyError(result.error)}`)
  }
}

console.log(`\n${files.length - failed}/${files.length} valid`)
process.exit(failed ? 1 : 0)
