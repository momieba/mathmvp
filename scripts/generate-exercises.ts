/**
 * Generates exercise drafts from a template.
 * Usage: npm run exercises:generate -- <template.json> [--seed N] [--force]
 * Output: drafts/exercises/<template-id>-<YYYYMMDD>.json (regular draft format → validate → math-checker → import)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateExercises } from '../src/features/exercises/template/generate'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args.splice(i, 2)[1]
}
const force = args.includes('--force') && (args.splice(args.indexOf('--force'), 1), true)
const seed = Number(flag('--seed') ?? 1)
const templatePath = args[0]
if (!templatePath || Number.isNaN(seed)) {
  console.error('Usage: npm run exercises:generate -- <template.json> [--seed N] [--force]')
  process.exit(1)
}

const template = JSON.parse(readFileSync(templatePath, 'utf8')) as { id: string; subtopic: string }
const outDir = join('drafts', 'exercises')
mkdirSync(outDir, { recursive: true })

const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const outName = `${template.id}-${date}${seed === 1 ? '' : `-seed${seed}`}.json`
const outFile = join(outDir, outName)
if (existsSync(outFile) && !force) {
  console.error(`${outFile} exists – use --force to overwrite or --seed N for another variant`)
  process.exit(1)
}

// Continue the running key number of this subtopic across all other drafts
// (the file being overwritten does not count).
const keyPattern = new RegExp(`"key"\\s*:\\s*"${template.subtopic}-(\\d{3})"`, 'g')
let maxIndex = 0
for (const file of readdirSync(outDir).filter((f) => f.endsWith('.json') && f !== outName)) {
  for (const m of readFileSync(join(outDir, file), 'utf8').matchAll(keyPattern)) {
    maxIndex = Math.max(maxIndex, Number(m[1]))
  }
}

const exercises = generateExercises(template, { seed, startIndex: maxIndex + 1 })
writeFileSync(outFile, JSON.stringify({ exercises }, null, 2) + '\n')

const byLevel = new Map<string, number>()
for (const e of exercises) {
  const label = `${e.placements[0]!.difficulty} / ${e.type}`
  byLevel.set(label, (byLevel.get(label) ?? 0) + 1)
}
console.log(`wrote ${exercises.length} exercises → ${outFile}`)
console.log(`keys ${exercises[0]!.key} … ${exercises.at(-1)!.key}`)
for (const [label, n] of byLevel) console.log(`  ${label}: ${n}`)
console.log('next: npm run drafts:validate -- ' + outFile + '  → then math-checker')
