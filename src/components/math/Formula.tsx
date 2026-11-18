import katex from 'katex'
import { useMemo } from 'react'

type FormulaProps = {
  /** LaTeX source, e.g. "\\frac{1}{2}" */
  tex: string
  /** Render as centered block (display mode) instead of inline. */
  block?: boolean
}

export function Formula({ tex, block = false }: FormulaProps) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: block, throwOnError: false, strict: 'warn' }),
    [tex, block],
  )
  const Tag = block ? 'div' : 'span'
  // Safe: KaTeX runs with `trust: false` (default), so \href, \url, \htmlClass etc. are disabled
  // and the output cannot contain scripts or links even for DB-sourced LaTeX.
  return <Tag dangerouslySetInnerHTML={{ __html: html }} />
}
