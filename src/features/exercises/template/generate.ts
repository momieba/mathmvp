import { all, create } from 'mathjs'
import { exerciseDraftFileSchema, type Exercise } from '../schema'
import { renderText, singlePlaceholder } from './format'
import { exerciseTemplateSchema, type ExerciseTemplate, type TemplateLevel } from './schema'

// Restricted mathjs instance: templates may compute, but not redefine the parser or units.
const math = create(all!, { number: 'number', matrix: 'Array' })
const evaluateExpr = math.evaluate.bind(math)
const blocked = () => {
  throw new Error('function disabled in templates')
}
math.import(
  {
    import: blocked,
    createUnit: blocked,
    evaluate: blocked,
    parse: blocked,
    simplify: blocked,
    derivative: blocked,
    resolve: blocked,
    reviver: blocked,
  },
  { override: true },
)

type Scope = Record<string, unknown>

/** Deterministic PRNG (mulberry32) so the same seed always yields the same exercises. */
export function createRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

function sampleParam(spec: TemplateLevel['params'][string], random: () => number): number {
  if ('values' in spec) return spec.values[Math.floor(random() * spec.values.length)]!
  const steps = Math.floor((spec.max - spec.min) / spec.step + 1e-9)
  const value = spec.min + Math.floor(random() * (steps + 1)) * spec.step
  return Math.round(value * 1e9) / 1e9
}

function evaluateIn(scope: Scope) {
  return (expr: string): unknown => {
    try {
      return evaluateExpr(expr, { ...scope })
    } catch (e) {
      throw new Error(`cannot evaluate "${expr}": ${(e as Error).message}`)
    }
  }
}

function renderDiagram(
  node: unknown,
  render: (s: string) => string,
  evaluate: (e: string) => unknown,
): unknown {
  if (typeof node === 'string') {
    const single = singlePlaceholder(node)
    if (!single) return render(node)
    const value = evaluate(single)
    // Round coordinates to avoid float noise like 2.2800000000000002 in stored diagrams.
    return typeof value === 'number' ? Math.round(value * 1e4) / 1e4 : value
  }
  if (Array.isArray(node)) return node.map((n) => renderDiagram(n, render, evaluate))
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, renderDiagram(v, render, evaluate)]),
    )
  }
  return node
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export type GenerateOptions = {
  seed?: number
  /** First running number for exercise keys (`<subtopic>-NNN`). */
  startIndex?: number
  /** Attempts per requested exercise before giving up (constraints/duplicates). */
  maxAttemptsPerExercise?: number
}

/** Generates exercise drafts from a template. Throws on template bugs (failed checks, invalid output). */
export function generateExercises(input: unknown, options: GenerateOptions = {}): Exercise[] {
  const template: ExerciseTemplate = exerciseTemplateSchema.parse(input)
  const seed = options.seed ?? 1
  const maxAttempts = options.maxAttemptsPerExercise ?? 500
  let index = options.startIndex ?? 1
  // Built untyped; the final exerciseDraftFileSchema.parse() is the single source of validity.
  const exercises: Record<string, unknown>[] = []
  const prompts = new Set<string>()
  // Template-level `uniqueBy` dedupes across all levels (e.g. the same Pythagorean triple must not
  // appear as a numeric and again as a multiple-choice exercise). Level-level `uniqueBy` (or none)
  // dedupes within that level only.
  const seenAcrossLevels = new Set<string>()

  for (const level of template.levels) {
    const random = createRandom(seed ^ hash(`${template.id}/${level.id}`))
    const params = { ...template.params, ...level.params }
    const derived = { ...template.derived, ...level.derived }
    const constraints = [...template.constraints, ...level.constraints]
    const uniqueBy = level.uniqueBy ?? template.uniqueBy
    const seen = level.uniqueBy || !template.uniqueBy ? new Set<string>() : seenAcrossLevels
    let produced = 0
    let attempts = 0

    while (produced < level.count) {
      if (++attempts > level.count * maxAttempts) {
        throw new Error(
          `level "${level.id}": only ${produced}/${level.count} distinct exercises possible – widen the parameter ranges or relax constraints`,
        )
      }
      const context = level.contexts[produced % level.contexts.length]!
      const scope: Scope = {}
      for (const [name, spec] of Object.entries(params)) scope[name] = sampleParam(spec, random)
      const sampled = JSON.stringify(scope)

      const evaluate = evaluateIn(scope)
      for (const [name, e] of Object.entries(derived)) scope[name] = evaluate(e)
      if (!constraints.every((c) => evaluate(c) === true)) continue

      // Duplicates are detected across all contexts of a level: same numbers in another
      // phrasing are still the same exercise. `uniqueBy` can normalise further (e.g. swapped sides).
      const dedupeKey = uniqueBy ? JSON.stringify(evaluate(uniqueBy)) : sampled
      if (seen.has(dedupeKey)) continue

      for (const check of template.checks) {
        if (evaluate(check) !== true) {
          throw new Error(`template check failed: "${check}" with ${JSON.stringify(scope)}`)
        }
      }

      const render = (t: string) => renderText(t, evaluate)
      const answerPart = buildAnswer(level, evaluate, render, random)
      if (!answerPart) continue // e.g. two multiple-choice options rendered identically → redraw
      const prompt = render(context.prompt)
      const exercise = {
        key: `${template.subtopic}-${String(index).padStart(3, '0')}`,
        subtopic: template.subtopic,
        placements: template.placements.map((p) => ({ ...p, difficulty: level.difficulty })),
        prompt,
        diagram:
          context.diagram === undefined
            ? undefined
            : renderDiagram(context.diagram, render, evaluate),
        hints: level.hints?.map(render),
        solution: {
          steps: level.solution.steps.map((s) => ({ text: render(s) })),
          result: render(level.solution.result),
        },
        inspiration: `Generiert aus Vorlage "${template.id}", Stufe "${level.id}", Seed ${seed}. Eigene Formulierung und Zahlen.`,
        ...answerPart,
      }
      // Same prompt from different parameters (e.g. symmetric swap) counts as duplicate.
      if (prompts.has(prompt)) continue

      seen.add(dedupeKey)
      prompts.add(prompt)
      exercises.push(exercise)
      produced++
      index++
    }
  }

  // Final validation against the regular draft schema (same as hand-written exercises).
  return exerciseDraftFileSchema.parse({ exercises }).exercises
}

function buildAnswer(
  level: TemplateLevel,
  evaluate: (e: string) => unknown,
  render: (t: string) => string,
  random: () => number,
) {
  const answer = level.answer
  if (answer.type === 'numeric') {
    const value = evaluate(answer.value)
    const tolerance = evaluate(answer.tolerance)
    if (typeof value !== 'number' || typeof tolerance !== 'number') {
      throw new Error(`level "${level.id}": numeric answer/tolerance must evaluate to numbers`)
    }
    return { type: 'numeric' as const, answer: { value, tolerance, unit: answer.unit } }
  }
  const correct = render(answer.correct)
  const distractors = answer.distractors.map(render)
  const options = shuffle([correct, ...distractors], random)
  // Duplicate options are a property of this sample, not a template bug → caller redraws.
  if (new Set(options).size !== options.length) return null
  return {
    type: 'multiple_choice' as const,
    answer: { options, correct: [options.indexOf(correct)] },
  }
}
