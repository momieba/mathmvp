import { CheckCircle2, Lightbulb, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { DiagramView } from '@/components/math/DiagramView'
import { RichText } from '@/components/math/RichText'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

  const topic = subtopic.data?.topics
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/app" className="text-muted-foreground text-sm hover:underline">
            ← Dashboard
          </Link>
          {topic && <span className="text-muted-foreground truncate text-sm">{topic.title}</span>}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {subtopic.isPending ? (
          <p className="text-muted-foreground">Lädt …</p>
        ) : !subtopic.data ? (
          <p role="alert">Dieses Subthema gibt es nicht.</p>
        ) : (
          <>
            <section>
              <h1 className="text-2xl font-bold tracking-tight">{subtopic.data.title}</h1>
              <ScoreBar score={score} attemptCount={mine?.attemptCount ?? 0} className="mt-3" />
            </section>

            {exercises.isPending ? (
              <p className="text-muted-foreground">Aufgaben werden geladen …</p>
            ) : !current ? (
              <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center">
                Für dieses Subthema gibt es noch keine Aufgaben. Schau bald wieder vorbei!
              </p>
            ) : (
              <ExerciseCard key={`${current.id}-${round}`} exercise={current} onNext={next} />
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
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
    <form onSubmit={onSubmit} className="bg-card flex flex-col gap-5 rounded-xl border p-5 sm:p-6">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span className="bg-secondary rounded-full px-2.5 py-1 font-medium">
          {difficultyLabels[exercise.difficulty]}
        </span>
      </div>

      <div className="leading-relaxed">
        <RichText text={exercise.prompt} />
      </div>
      {exercise.diagram && <DiagramView diagram={exercise.diagram} />}

      {exercise.type === 'numeric' ? (
        <div className="flex items-center gap-2">
          <Input
            aria-label="Deine Antwort"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Deine Antwort"
            className="h-10 max-w-48"
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
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                  isSelected && !result && 'border-primary bg-primary/5',
                  result && isCorrect && 'border-emerald-600 bg-emerald-600/10',
                  result && isSelected && !isCorrect && 'border-destructive bg-destructive/10',
                )}
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name="option"
                  className="accent-primary"
                  checked={isSelected}
                  disabled={!!result}
                  onChange={() =>
                    setSelected((s) =>
                      multi ? (isSelected ? s.filter((x) => x !== i) : [...s, i]) : [i],
                    )
                  }
                />
                <RichText text={option} />
              </label>
            )
          })}
        </fieldset>
      )}

      {hints.length > 0 && !result && (
        <ul className="space-y-2">
          {hints.map((h, i) => (
            <li key={i} className="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-sm">
              <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <RichText text={h} />
            </li>
          ))}
        </ul>
      )}

      {submit.error && (
        <p role="alert" className="text-destructive text-sm">
          Das hat nicht geklappt: {submit.error.message}
        </p>
      )}

      {result && <ResultPanel result={result} />}

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          className="h-10 px-5"
          disabled={(!result && !canSubmit) || submit.isPending}
        >
          {result ? 'Nächste Aufgabe' : 'Prüfen'}
        </Button>
        {!result && (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={noMoreHints}
            onClick={() => void nextHint()}
          >
            {noMoreHints ? 'Keine weiteren Hinweise' : 'Hinweis'}
          </Button>
        )}
        {result && (
          <Link to="/app" className={cn(buttonVariants({ variant: 'ghost' }), 'h-10')}>
            Zurück zum Dashboard
          </Link>
        )}
      </div>
    </form>
  )
}

function formatNumber(n: number) {
  return String(n).replace('.', ',')
}

function ResultPanel({ result }: { result: SubmitResult }) {
  const { answer } = result
  const correctText =
    answer.value !== undefined
      ? `${formatNumber(answer.value)}${answer.unit ? ` ${answer.unit}` : ''}`
      : answer.correct?.map((i) => answer.options?.[i]).join(', ')

  return (
    <div
      role="status"
      className={cn(
        'rounded-lg border p-4',
        result.correct
          ? 'border-emerald-600/40 bg-emerald-600/5'
          : 'border-destructive/40 bg-destructive/5',
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        {result.correct ? (
          <>
            <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-600" /> Richtig!
          </>
        ) : (
          <>
            <XCircle aria-hidden="true" className="text-destructive size-5" /> Leider falsch.
            {correctText && (
              <span className="font-normal">
                Richtig ist: <RichText text={correctText} />
              </span>
            )}
          </>
        )}
      </p>
      <div className="mt-4">
        <p className="text-sm font-medium">Lösungsweg</p>
        <ol className="mt-2 space-y-2 text-sm">
          {result.solution.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span
                aria-hidden="true"
                className="bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold"
              >
                {i + 1}
              </span>
              <div>
                <RichText text={step.text} />
                {step.diagram && <DiagramView diagram={step.diagram} />}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm">
          <span className="font-medium">Ergebnis:</span> <RichText text={result.solution.result} />
        </p>
      </div>
    </div>
  )
}
