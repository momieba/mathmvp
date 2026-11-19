const SEPARATOR = String.raw`(?:\\mid(?![a-zA-Z])|\s*\\[,;:]\s*\|\s*\\[,;:])`
const SPLIT = new RegExp(`\\s*${SEPARATOR}\\s*`)
const BAR = String.raw`\,\mathpunct{|}`

const NUMBER = String.raw`\d+(?:\{,\}\d+|[.,]\d+)?`
const FRACTION = String.raw`\\frac\{\s*[-+]?\s*${NUMBER}\s*\}\{\s*${NUMBER}\s*\}`
// a coordinate: signed number / fraction / root, or a lone variable like `x` or `2a`
const NUMERIC_PART = new RegExp(
  String.raw`^[-+]?\s*(?:${FRACTION}|\\sqrt\{\s*${NUMBER}\s*\}|${NUMBER}(?:\s*/\s*${NUMBER})?)$`,
)
const VARIABLE_PART = new RegExp(String.raw`^[-+]?\s*(?:${NUMBER})?\s*[a-zA-Z]$`)

/** `(2 \mid -1)`, `(\frac{1}{2} \mid x)` – but not `(A \mid B)` as in P(A \mid B). */
function looksLikePoint(inner: string): boolean {
  const parts = inner.split(SPLIT).map((p) => p.trim())
  if (parts.length < 2 || parts.length > 3) return false
  const simple = parts.every((p) => NUMERIC_PART.test(p) || VARIABLE_PART.test(p))
  return simple && parts.some((p) => NUMERIC_PART.test(p))
}

/**
 * Normalises point coordinates `A(2 \mid -1)` / `A(2\,|\,-1)` to `A(2\,\mathpunct{|}-1)`.
 * `\mid` is a relation (and `|` after `\,` makes a following minus a binary operator); KaTeX allows
 * line breaks after both. As punctuation the bar keeps thin spaces on both sides, a following
 * minus stays a sign and no break is possible inside the parentheses. Only innermost parentheses
 * whose content looks like coordinates are touched – set-builder notation `\{x \mid …\}` and
 * conditional probability `P(A \mid B)` stay as they are.
 */
export function normalizePoints(tex: string): string {
  return tex.replace(/\(([^()]*)\)/g, (whole, inner: string) => {
    // `\left(` / `\right)` leave their keyword in the match
    const body = inner.replace(/\\right\s*$/, '')
    const tail = inner.slice(body.length)
    return looksLikePoint(body)
      ? `(${body
          .split(SPLIT)
          .map((p) => p.trim())
          .join(BAR)}${tail})`
      : whole
  })
}
