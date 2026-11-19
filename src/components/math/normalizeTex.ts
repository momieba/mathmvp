const SEPARATOR = String.raw`(?:\\mid|\s*\\[,;:]\s*\|\s*\\[,;:])`
const HAS_SEPARATOR = new RegExp(SEPARATOR)
const SEPARATOR_G = new RegExp(String.raw`\s*${SEPARATOR}\s*`, 'g')
const BAR = String.raw`\,\mathpunct{|}`

/**
 * Normalises point coordinates `A(2 \mid -1)` / `A(2\,|\,-1)` to `A(2\,\mathpunct{|}-1)`.
 * `\mid` is a relation (and `|` after `\,` makes a following minus a binary operator); KaTeX allows
 * line breaks after both. As punctuation the bar keeps thin spaces on both sides, a following
 * minus stays a sign and no break is possible inside the parentheses. Only innermost parentheses
 * containing such a separator are touched – set-builder notation `\{x \mid …\}` stays as it is.
 */
export function normalizePoints(tex: string): string {
  return tex.replace(/\(([^()]*)\)/g, (whole, inner: string) =>
    HAS_SEPARATOR.test(inner) ? `(${inner.replace(SEPARATOR_G, () => BAR).trim()})` : whole,
  )
}
