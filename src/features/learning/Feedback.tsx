import { LightbulbIcon } from 'lucide-react'
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
  correct: 'Stimmt.',
  incorrect: 'Hier stimmt etwas nicht.',
  unclear: 'Das kann ich nicht sicher lesen.',
} as const
const finalFallback = {
  incorrect: 'Dein Endergebnis stimmt nicht.',
  missing: 'Ich finde kein Endergebnis. Schreib es zum Schluss deutlich auf.',
} as const

/** AI disclosure: stays visible wherever a handwritten solution was corrected. */
function AiNote() {
  return (
    <p className="text-fine text-muted-foreground mt-3 font-sans font-normal">
      Korrigiert von einer KI – sie kann sich irren.
    </p>
  )
}

/**
 * Yellow highlighter tip about tidiness. Only for `tidy === false`; never affects the verdict.
 * Icon + title + text, so it does not rely on colour.
 */
function PresentationTip({ presentation }: { presentation: Graded['presentation'] }) {
  if (!presentation || presentation.tidy !== false) return null
  return (
    <aside
      data-testid="presentation-tip"
      className="bg-marker text-marker-foreground mt-3 flex gap-2 rounded-[2px] px-3 py-2 font-sans"
    >
      <LightbulbIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">Tipp zur Darstellung</p>
        <p>{presentation.comment || 'Schreib deine Schritte übersichtlich untereinander auf.'}</p>
      </div>
    </aside>
  )
}

/**
 * Correction of a handwritten solution like a teacher: every step gets one short note in order –
 * check for correct ones, cross for wrong ones (underlined in the drawing with the same number),
 * question mark for unclear ones – then a closing line that tells "almost there" from "not quite".
 */
export function HandwritingNotes({
  result,
  showWork = false,
}: {
  result: Graded
  /** Quote every flagged line (no drawing with underlines next to it, e.g. exam results). */
  showWork?: boolean
}) {
  const listed = result.steps.map((step, i) => ({ step, n: i + 1 }))
  const noteOf = ({ step, n }: (typeof listed)[number], i: number) => {
    const verdict = step.verdict
    return (
      <MarginNote
        key={n}
        status={verdict === 'correct' ? 'correct' : verdict === 'incorrect' ? 'wrong' : 'unclear'}
        step={n}
        index={i}
        animate
      >
        {/* Without an underline in the drawing, quote the line so the student finds it. */}
        {(showWork || !step.box) && step.studentWork && (
          <span className="text-fine text-muted-foreground block font-sans font-normal">
            <RichText text={asMath(step.studentWork)} />
          </span>
        )}
        <RichText text={step.comment || stepFallback[verdict]} />
      </MarginNote>
    )
  }
  const stepNotes = listed.map(noteOf)

  // Solved: clear positive summary (notation remarks on single steps and the yellow tip stay).
  if (result.correct) {
    return (
      <div className="flex flex-col gap-3">
        {/* Only remarks (unclear, e.g. notation) – a clean solution gets one note. */}
        {listed.map((l, i) => (l.step.verdict === 'unclear' ? noteOf(l, i) : null))}
        <MarginNote status="correct" index={listed.length} animate>
          <span className="font-semibold">Richtig gelöst!</span>
          {result.summary && (
            <>
              {' '}
              <RichText text={result.summary} />
            </>
          )}
        </MarginNote>
        <PresentationTip presentation={result.presentation} />
        <AiNote />
      </div>
    )
  }

  const hasWrongStep = listed.some(({ step }) => step.verdict === 'incorrect')
  const hasCorrectStep = listed.some(({ step }) => step.verdict === 'correct')
  const correctText = correctAnswerText(result.answer)
  const final = result.final.verdict
  // Working right, only the result is not written down: fair wording (still counts as not solved).
  const almost = !hasWrongStep && hasCorrectStep && final === 'missing'

  return (
    <div className="flex flex-col gap-3">
      {stepNotes}
      {/* The result only gets its own line when no step explains what went wrong. */}
      {!hasWrongStep && final !== 'correct' && (
        <MarginNote
          status={final === 'missing' ? 'missing' : 'wrong'}
          index={listed.length}
          animate
        >
          <RichText text={result.final.comment || finalFallback[final]} />
        </MarginNote>
      )}
      <MarginNote status={almost ? 'missing' : 'wrong'} index={listed.length + 1} animate>
        {almost
          ? 'Fast geschafft – deine Rechnung stimmt, es fehlt nur das Endergebnis.'
          : 'Nicht ganz.'}
        {correctText && (
          <>
            {' '}
            Richtig ist: <RichText text={correctText} />
          </>
        )}
      </MarginNote>
      <PresentationTip presentation={result.presentation} />
      <AiNote />
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
