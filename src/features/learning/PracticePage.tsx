import { Lightbulb } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { AppHeader } from '@/components/layout/AppHeader'
import { PageShell } from '@/components/layout/PageShell'
import { DiagramView } from '@/components/math/DiagramView'
import { RichText } from '@/components/math/RichText'
import { GridPaper } from '@/components/paper/GridPaper'
import { MarginNote } from '@/components/paper/MarginNote'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buttonClass } from '@/lib/buttonClass'
import { cn } from '@/lib/utils'
import {
  fetchHint,
  usePracticeExercises,
  useProgress,
  useSubmitAnswer,
  useSubtopic,
  type PracticeExercise,
  type SubmitResult,
} from './api'
import { ScoreBar } from './ScoreBar'
import { selectExercise } from './selectExercise'

const difficultyLabels = {
  leicht: 'leicht',
  mittel: 'mittel',
  schwer: 'schwer',
  sehr_schwer: 'sehr schwer',
} as const

export function PracticePage() {
  const { slug = '' } = useParams()
  const subtopic = useSubtopic(slug)
  const exercises = usePracticeExercises(subtopic.data?.id)
  const progress = useProgress()
  const [round, setRound] = useState(0)
  const [pickedId, setPickedId] = useState<string | null>(null)

  const mine = subtopic.data ? progress.data?.get(subtopic.data.id) : undefined
  const score = mine?.score ?? 0

  const pick = (exclude: string | null) =>
    exercises.data
      ? selectExercise(exercises.data, {
          score,
          recentIds: [...(exclude ? [exclude] : []), ...(mine?.recentExerciseIds ?? [])],
        })
      : null

  // The current exercise stays fixed until "Nächste Aufgabe" (progress refetches must not swap it).
  const current =
    exercises.data?.find((e) => e.id === pickedId) ?? (pickedId === null ? pick(null) : null)
  if (current && pickedId === null) setPickedId(current.id)

  function next() {
    setPickedId(pick(current?.id ?? null)?.id ?? null)
    setRound((r) => r + 1)
  }

  return (
    <PageShell
      width="reading"
      header={<AppHeader width="reading" back={{ to: '/app', label: 'Meine Themen' }} />}
    >
      {subtopic.isPending ? (
        <p role="status" className="text-muted-foreground">
          Die Aufgaben werden geladen …
        </p>
      ) : !subtopic.data ? (
        <div role="alert">
          <h1 className="text-h2">Diesen Abschnitt gibt es nicht.</h1>
          <p className="text-muted-foreground mt-2">
            Geh zurück zu deinen Themen und wähl einen Abschnitt aus.
          </p>
          <Link to="/app" className={buttonClass({ variant: 'outline' }, 'mt-4')}>
            Zu meinen Themen
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section>
            <h1 className="text-title">{subtopic.data.title}</h1>
            <ScoreBar score={score} attemptCount={mine?.attemptCount ?? 0} className="mt-3" />
          </section>

          {exercises.isPending ? (
            <p role="status" className="text-muted-foreground">
              Die Aufgaben werden geladen …
            </p>
          ) : !current ? (
            <p className="text-prose border-y py-6">
              Für diesen Abschnitt gibt es noch keine Aufgaben. Üb in der Zwischenzeit ein anderes
              Thema.
            </p>
          ) : (
            <ExerciseCard key={`${current.id}-${round}`} exercise={current} onNext={next} />
          )}
        </div>
      )}
    </PageShell>
  )
}

function ExerciseCard({ exercise, onNext }: { exercise: PracticeExercise; onNext: () => void }) {
  const submit = useSubmitAnswer()
  const [value, setValue] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [hints, setHints] = useState<string[]>([])
  const [noMoreHints, setNoMoreHints] = useState(false)
  const result = submit.data
  const multi = exercise.presentation.multi === true

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (result) return onNext()
    submit.mutate({
      exerciseId: exercise.id,
      answer: exercise.type === 'numeric' ? { value } : { selected },
    })
  }

  async function nextHint() {
    const hint = await fetchHint(exercise.id, hints.length)
    if (hint) setHints((h) => [...h, hint])
    else setNoMoreHints(true)
  }

  const canSubmit = exercise.type === 'numeric' ? value.trim() !== '' : selected.length > 0

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Aufgabe */}
      <section aria-labelledby="task-heading">
        <h2 id="task-heading" className="text-fine text-muted-foreground font-sans font-normal">
          Aufgabe, {difficultyLabels[exercise.difficulty]}
        </h2>
        <div className="text-prose measure mt-1">
          <RichText text={exercise.prompt} />
        </div>
        {exercise.diagram && <DiagramView diagram={exercise.diagram} />}
      </section>

      {/* Antwortbereich: das Blatt mit Rand. Hier zieht in Etappe 6 die Zeichenfläche ein. */}
      <GridPaper
        as="section"
        raised
        aria-label="Antwortbereich"
        margin={<div role="status">{result && <ResultNote result={result} />}</div>}
        marginClassName="max-md:has-[[role=status]:empty]:hidden"
        contentClassName="py-4"
      >
        {exercise.type === 'numeric' ? (
          <div className="flex items-center gap-3">
            <Input
              aria-label="Deine Antwort"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Deine Antwort"
              className="bg-background disabled:bg-background dark:bg-background dark:disabled:bg-background max-w-48 disabled:opacity-100"
              value={value}
              disabled={!!result}
              onChange={(e) => setValue(e.target.value)}
            />
            {exercise.presentation.unit && (
              <span className="text-muted-foreground">{exercise.presentation.unit}</span>
            )}
          </div>
        ) : (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Antwortmöglichkeiten</legend>
            {(exercise.presentation.options ?? []).map((option, i) => {
              const isSelected = selected.includes(i)
              const isCorrect = result?.answer.correct?.includes(i)
              return (
                <label
                  key={i}
                  className={cn(
                    'bg-background flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 p-3',
                    isSelected && !result && 'border-primary',
                    result && isCorrect && 'border-correct',
                    result && isSelected && !isCorrect && 'border-wrong',
                  )}
                >
                  <input
                    type={multi ? 'checkbox' : 'radio'}
                    name="option"
                    className="accent-primary size-5 shrink-0"
                    checked={isSelected}
                    disabled={!!result}
                    onChange={() =>
                      setSelected((s) =>
                        multi ? (isSelected ? s.filter((x) => x !== i) : [...s, i]) : [i],
                      )
                    }
                  />
                  <RichText text={option} />
                  {result && isCorrect && (
                    <span className="text-correct text-fine ml-auto">richtig</span>
                  )}
                  {result && isSelected && !isCorrect && (
                    <span className="text-wrong text-fine ml-auto">deine Wahl</span>
                  )}
                </label>
              )
            })}
          </fieldset>
        )}
      </GridPaper>

      {/* Hinweise */}
      {hints.length > 0 && !result && (
        <ul className="space-y-2" aria-label="Hinweise">
          {hints.map((h, i) => (
            <li key={i} className="bg-marker text-marker-foreground flex gap-3 rounded-lg p-3">
              <Lightbulb aria-hidden="true" className="mt-1 size-5 shrink-0" />
              <span>
                <span className="font-semibold">Hinweis {i + 1}: </span>
                <RichText text={h} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {submit.error && (
        <p role="alert" className="text-destructive">
          Das hat nicht geklappt: {submit.error.message} Versuch es noch einmal.
        </p>
      )}

      {/* Musterlösung: zweites Blatt */}
      {result && <Solution result={result} />}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          className="px-6"
          disabled={(!result && !canSubmit) || submit.isPending}
        >
          {result ? 'Nächste Aufgabe' : 'Prüfen'}
        </Button>
        {!result && (
          <Button
            type="button"
            variant="outline"
            disabled={noMoreHints}
            onClick={() => void nextHint()}
          >
            {noMoreHints
              ? 'Keine weiteren Hinweise'
              : hints.length > 0
                ? 'Noch ein Hinweis'
                : 'Hinweis'}
          </Button>
        )}
        {result && (
          <Link to="/app" className={buttonClass({ variant: 'ghost' })}>
            Zurück zu meinen Themen
          </Link>
        )}
      </div>
    </form>
  )
}

function formatNumber(n: number) {
  return String(n).replace('.', ',')
}

/** Correction in the margin of the answer sheet (later: one note per handwritten step). */
function ResultNote({ result }: { result: SubmitResult }) {
  const { answer } = result
  const correctText =
    answer.value !== undefined
      ? `${formatNumber(answer.value)}${answer.unit ? ` ${answer.unit}` : ''}`
      : answer.correct?.map((i) => answer.options?.[i]).join(', ')

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

function Solution({ result }: { result: SubmitResult }) {
  return (
    <GridPaper as="section" aria-labelledby="solution-heading" contentClassName="py-4">
      <h2 id="solution-heading" className="text-h3">
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
