/**
 * Model output that should be a formula but may come without `$…$` (e.g. `-3 \cdot (-1) + b = -2`):
 * wraps bare LaTeX/formulas so RichText renders them instead of showing the source.
 */
export function asMath(text: string): string {
  const t = text.trim()
  if (t === '' || t.includes('$')) return t
  return /\\[a-zA-Z]+|[=^_{}]/.test(t) ? `$${t}$` : t
}
