export type TextBlock =
  { kind: 'text'; text: string } | { kind: 'table'; header: string[]; rows: string[][] }

const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line)
const isSeparator = (line: string) => /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(line)
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

/** Splits text into plain-text blocks and Markdown tables (header row + `|---|` separator). */
export function splitBlocks(text: string): TextBlock[] {
  const lines = text.split('\n')
  const blocks: TextBlock[] = []
  let buffer: string[] = []
  const flush = () => {
    if (buffer.length) blocks.push({ kind: 'text', text: buffer.join('\n') })
    buffer = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (isTableLine(line) && lines[i + 1] !== undefined && isSeparator(lines[i + 1]!)) {
      // drop the newline right before a table; the table is its own block
      if (buffer.at(-1) === '') buffer.pop()
      flush()
      const header = cells(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && isTableLine(lines[i]!)) rows.push(cells(lines[i++]!))
      i-- // compensate loop increment
      blocks.push({ kind: 'table', header, rows })
      if (lines[i + 1] === '') i++ // skip the blank line after a table
    } else {
      buffer.push(line)
    }
  }
  flush()
  return blocks
}

const MATH = /(\$\$[\s\S]+?\$\$|(?<!\\)\$[^$]+?(?<!\\)\$)/g

/** Splits text into plain and LaTeX parts: `$…$` inline, `$$…$$` block, `\$` is a literal dollar. */
export function splitMath(text: string): { kind: 'text' | 'inline' | 'block'; value: string }[] {
  return text
    .split(MATH)
    .filter((part) => part !== '')
    .map((part) => {
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4)
        return { kind: 'block' as const, value: part.slice(2, -2) }
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2)
        return { kind: 'inline' as const, value: part.slice(1, -1) }
      return { kind: 'text' as const, value: part.replace(/\\\$/g, '$') }
    })
}
