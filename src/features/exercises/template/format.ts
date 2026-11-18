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
