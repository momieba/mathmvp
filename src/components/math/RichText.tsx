import { Fragment } from 'react'
import { Formula } from './Formula'
import { splitMath } from './splitMath'

/** Renders exercise text: plain text with inline/block LaTeX and **bold**; line breaks kept. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {splitMath(text).map((part, i) =>
        part.kind === 'text' ? (
          <Fragment key={i}>{renderPlain(part.value)}</Fragment>
        ) : (
          <Formula key={i} tex={part.value} block={part.kind === 'block'} />
        ),
      )}
    </span>
  )
}

function renderPlain(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\n)/g).map((chunk, i) => {
    if (chunk === '\n') return <br key={i} />
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4)
      return <strong key={i}>{chunk.slice(2, -2)}</strong>
    return <Fragment key={i}>{chunk}</Fragment>
  })
}
