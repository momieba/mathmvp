/**
 * Formats a number the German way: decimal comma, no float noise.
 * - `decimals` given → fixed number of decimals (2.5 with 2 → "2,50")
 * - otherwise → rounded to 6 decimals, trailing zeros removed (2.50000001 → "2,5")
 * In LaTeX the comma is written as `{,}` so KaTeX does not add a space after it.
 */
export function formatNumber(value: number, opts: { decimals?: number; tex?: boolean } = {}) {
  if (!Number.isFinite(value)) throw new Error(`cannot format non-finite number ${value}`)
  const rounded =
    opts.decimals === undefined
      ? String(Math.round(value * 1e6) / 1e6)
      : (Math.round(value * 10 ** opts.decimals) / 10 ** opts.decimals).toFixed(opts.decimals)
  const normalized = rounded === '-0' || /^-0(\.0+)?$/.test(rounded) ? rounded.slice(1) : rounded
  return normalized.replace('.', opts.tex ? '{,}' : ',')
}

/** Number as LaTeX text (decimal comma as `{,}`), e.g. 2.5 → "2{,}5". */
export function texNumber(value: number) {
  return formatNumber(value, { tex: true })
}

/**
 * Number as LaTeX fraction: integers stay integers, otherwise `\frac{n}{d}` (negative: `-\frac{n}{d}`).
 * `maxDenominator` limits the search for the fraction (default 1000); throws if the value is no such fraction.
 */
export function texFraction(value: number, maxDenominator = 1000) {
  if (!Number.isFinite(value)) throw new Error(`cannot format non-finite number ${value}`)
  const rounded = Math.round(value)
  if (Math.abs(value - rounded) < 1e-9) return texNumber(rounded)
  for (let d = 2; d <= maxDenominator; d++) {
    const n = Math.round(Math.abs(value) * d)
    if (Math.abs(Math.abs(value) - n / d) < 1e-9) {
      const g = gcd(n, d)
      return `${value < 0 ? '-' : ''}\\frac{${n / g}}{${d / g}}`
    }
  }
  throw new Error(`${value} is not a fraction with denominator <= ${maxDenominator}`)
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Number with explicit sign for building terms: 3 → "+ 3", -3 → "- 3" (absolute value as LaTeX number). */
export function texSigned(value: number) {
  return `${value < 0 ? '-' : '+'} ${texNumber(Math.abs(value))}`
}

/** Coefficient in front of a variable: 1 → "", -1 → "-", otherwise the number (3 → "3", 2.5 → "2{,}5"). */
export function texCoef(a: number) {
  if (a === 1) return ''
  if (a === -1) return '-'
  return texNumber(a)
}

/**
 * Coefficient times inserted value, never "1 \cdot": a = 1 → value, a = -1 → "-" + value,
 * otherwise `a \cdot x`. A negative inserted value gets parentheses where needed
 * (a = -1 and the `\cdot` form); with a = 1 it stays bare ("-3"), so use it after "=" or at the start of a term.
 */
export function texTimes(a: number, x: number) {
  const value = texParen(x)
  if (a === 1) return texNumber(x)
  if (a === -1) return x === 0 ? '0' : `-${value}`
  return `${texNumber(a)} \\cdot ${value}`
}

/** Value in parentheses if negative: 3 → "3", -3 → "(-3)" (for "x : (-3)", "y - (-2)"). */
export function texParen(x: number) {
  return x < 0 ? `(${texNumber(x)})` : texNumber(x)
}

/**
 * Like `texSignedTerm` for inserted values (checks/Probe): sign of `a`, then |a| times `x` without "1 cdot":
 * (2, 3) → "+ 2 cdot 3", (-4, -3) → "- 4 cdot (-3)", (-1, 3) → "- 3", (1, -3) → "+ (-3)".
 */
export function texSignedTimes(a: number, x: number) {
  const abs = Math.abs(a)
  return `${a < 0 ? '-' : '+'} ${abs === 1 ? texParen(x) : texTimes(abs, x)}`
}

/** Term with explicit sign for building sums: (3, "x") → "+ 3x", (-1, "y") → "- y", (1, "x") → "+ x". */
export function texSignedTerm(a: number, variable: string) {
  const abs = Math.abs(a)
  return `${a < 0 ? '-' : '+'} ${abs === 1 ? '' : texNumber(abs)}${variable}`
}

const PLACEHOLDER = /\{\{\s*([^}:]+?)\s*(?::\s*(\d+)\s*)?\}\}/g

/** Whether position `index` of `template` lies inside `$…$` / `$$…$$` math. */
function inMath(template: string, index: number) {
  let dollars = 0
  for (let i = 0; i < index; i++) {
    if (template[i] === '$' && template[i - 1] !== '\\') dollars++
  }
  return dollars % 2 === 1
}

/** Replaces `{{expr}}` / `{{expr:decimals}}` using `evaluate`; numbers are formatted German-style. */
export function renderText(template: string, evaluate: (expr: string) => unknown): string {
  return template.replace(
    PLACEHOLDER,
    (_match, expr: string, decimals: string | undefined, offset: number) => {
      const value = evaluate(expr)
      if (typeof value === 'number') {
        return formatNumber(value, {
          decimals: decimals === undefined ? undefined : Number(decimals),
          tex: inMath(template, offset),
        })
      }
      if (typeof value === 'string') return value
      throw new Error(
        `placeholder {{${expr}}} evaluated to ${typeof value}, expected number or string`,
      )
    },
  )
}

/** If `s` is exactly one placeholder, returns its expression. */
export function singlePlaceholder(s: string): string | null {
  const m = /^\{\{\s*([^}:]+?)\s*\}\}$/.exec(s)
  return m ? m[1]! : null
}
