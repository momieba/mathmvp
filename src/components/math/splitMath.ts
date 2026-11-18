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
