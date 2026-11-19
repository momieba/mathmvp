import { Fragment } from 'react'
import { Formula } from './Formula'
import { splitBlocks, splitMath } from './splitMath'

/**
 * Renders exercise text: plain text with inline/block LaTeX, **bold**, line breaks and
 * Markdown tables (e.g. value tables `| x | 1 | 2 |`).
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {splitBlocks(text).map((block, i) =>
        block.kind === 'table' ? (
          <span key={i} className="my-3 block overflow-x-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  {block.header.map((cell, c) => (
                    <th key={c} className="bg-secondary border px-3 py-1.5 font-medium">
                      <Inline text={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className="border px-3 py-1.5 text-center">
                        <Inline text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </span>
        ) : (
          <Inline key={i} text={block.text} />
        ),
      )}
    </span>
  )
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {splitMath(text).map((part, i) =>
        part.kind === 'text' ? (
          <Fragment key={i}>{renderPlain(part.value)}</Fragment>
        ) : (
          <Formula key={i} tex={part.value} block={part.kind === 'block'} />
        ),
      )}
    </>
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
