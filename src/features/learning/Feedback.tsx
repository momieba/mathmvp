import { useId } from 'react'
import { asMath } from '@/components/math/asMath'
import { DiagramView } from '@/components/math/DiagramView'
import { RichText } from '@/components/math/RichText'
import { GridPaper } from '@/components/paper/GridPaper'
import { MarginNote } from '@/components/paper/MarginNote'
import type { HandwritingResult, SubmitResult } from './api'
import { correctAnswerText } from './feedbackText'

export type Graded = Extract<HandwritingResult, { status: 'graded' }>
export type Result = Pick<SubmitResult, 'correct' | 'answer' | 'solution'>

/** Correction of a typed answer (multiple choice / number) in the margin. */
export function ResultNote({ result }: { result: Result }) {
  const correctText = correctAnswerText(result.answer)
  return result.correct ? (
    <MarginNote status="correct" animate>
      Stimmt!
    </MarginNote>
  ) : (
    <MarginNote status="wrong" animate>
      Nicht ganz.
      {correctText && (
        <>
          {' '}
          Richtig ist: <RichText text={correctText} />
        </>
      )}
    </MarginNote>
  )
}

const stepFallback = {
  incorrect: 'Hier stimmt etwas nicht.',
  unclear: 'Das kann ich nicht sicher lesen.',
} as const
const finalFallback = {
  incorrect: 'Dein Endergebnis stimmt nicht.',
  missing: 'Ich finde kein Endergebnis. Schreib es zum Schluss deutlich auf.',
} as const

/**
 * Compact correction of a handwritten solution: only what needs attention. Correct steps are not
 * listed; each wrong/unclear step gets one short note (its mistake is underlined in the drawing with
 * the same number), then one closing line with the correct result.
 */
export function HandwritingNotes({ result }: { result: Graded }) {
  if (result.correct) {
    return (
      <MarginNote status="correct" animate>
        Stimmt!
        {result.summary && (
          <>
            {' '}
            <RichText text={result.summary} />
          </>
        )}
      </MarginNote>
    )
  }

  const flagged = result.steps.flatMap((step, i) =>
    step.verdict === 'correct' ? [] : [{ step, n: i + 1 }],
  )
  const hasWrongStep = flagged.some(({ step }) => step.verdict === 'incorrect')
  const correctText = correctAnswerText(result.answer)
  const final = result.final.verdict

  return (
    <div className="flex flex-col gap-3">
      {flagged.map(({ step, n }, i) => {
        const verdict = step.verdict === 'incorrect' ? 'incorrect' : 'unclear'
        return (
          <MarginNote
            key={n}
            status={verdict === 'incorrect' ? 'wrong' : 'unclear'}
            step={n}
            index={i}
            animate
          >
            {/* Without an underline in the drawing, quote the line so the student finds it. */}
            {!step.box && step.studentWork && (
              <span className="text-fine text-muted-foreground block font-sans font-normal">
                <RichText text={asMath(step.studentWork)} />
              </span>
            )}
            <RichText text={step.comment || stepFallback[verdict]} />
          </MarginNote>
        )
      })}
      {/* The result only gets its own line when no step explains what went wrong. */}
      {!hasWrongStep && final !== 'correct' && (
        <MarginNote
          status={final === 'missing' ? 'unclear' : 'wrong'}
          index={flagged.length}
          animate
        >
          <RichText text={result.final.comment || finalFallback[final]} />
        </MarginNote>
      )}
      <MarginNote status="wrong" index={flagged.length + 1} animate>
        Nicht ganz.
        {correctText && (
          <>
            {' '}
            Richtig ist: <RichText text={correctText} />
          </>
        )}
      </MarginNote>
    </div>
  )
}

export function Solution({ result }: { result: Pick<Result, 'solution'> }) {
  const headingId = useId()
  return (
    <GridPaper as="section" aria-labelledby={headingId} contentClassName="py-4">
      <h2 id={headingId} className="text-h3">
        Musterlösung
      </h2>
      <ol className="mt-3 space-y-4">
        {result.solution.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden="true" className="casual text-primary w-6 shrink-0 text-lg">
              {i + 1}
            </span>
            <div className="min-w-0">
              <RichText text={step.text} />
              {step.diagram && <DiagramView diagram={step.diagram} />}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t-2 pt-3">
        <span className="font-semibold">Ergebnis: </span>
        <mark className="bg-marker text-marker-foreground rounded-[2px] px-1">
          <RichText text={result.solution.result} />
        </mark>
      </p>
    </GridPaper>
  )
}
