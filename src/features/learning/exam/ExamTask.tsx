import { Camera, Pencil } from 'lucide-react'
import { useRef, useState } from 'react'
import { DiagramView } from '@/components/math/DiagramView'
import { RichText } from '@/components/math/RichText'
import { GridPaper } from '@/components/paper/GridPaper'
import { MarginNote } from '@/components/paper/MarginNote'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { PracticeExercise, UnreadableReason } from '../api'
import { HANDWRITING_ENABLED } from '../config'
import { HandwritingCanvas, type HandwritingCanvasHandle } from '../HandwritingCanvas'
import { PhotoInput } from '../PhotoInput'
import { gradeExamHandwriting, submitExamAnswer } from './api'

export type TaskStatus = 'open' | 'saving' | 'saved' | 'grading' | 'unreadable' | 'error'

const unreadableTips: Record<UnreadableReason, string> = {
  empty: 'Auf deiner Abgabe steht noch nichts, das ich lesen kann.',
  illegible: 'Schreib deutlicher, mit etwas mehr Abstand zwischen den Zeilen.',
  off_topic: 'Das sieht nicht nach einer Lösung zu dieser Aufgabe aus.',
  photo_quality: 'Mach das Foto bei gutem Licht, gerade und scharf.',
}

/**
 * One exam task. Stays mounted while the student switches tasks (the drawing survives); answers are
 * saved right away, handwritten ones are graded in the background – nothing is revealed until the end.
 */
export function ExamTask({
  exercise,
  number,
  sessionId,
  active,
  status,
  onStatus,
  track,
  onSubmitted,
}: {
  exercise: PracticeExercise
  number: number
  sessionId: string
  active: boolean
  status: TaskStatus
  onStatus: (status: TaskStatus) => void
  /** Registers background work the exam must wait for before it is submitted. */
  track: (work: Promise<unknown>) => void
  /** Called after a handwritten answer was handed in (the exam moves on). */
  onSubmitted: () => void
}) {
  const handwriting =
    HANDWRITING_ENABLED && (exercise.type === 'numeric' || exercise.type === 'handwritten')
  const choice = !handwriting && exercise.type === 'multiple_choice'
  const multi = exercise.presentation.multi === true
  const canvasRef = useRef<HandwritingCanvasHandle>(null)
  const chain = useRef<Promise<unknown>>(Promise.resolve()) // saves in click order
  const [selected, setSelected] = useState<number[]>([])
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<'drawing' | 'photo'>('drawing')
  const [hasInk, setHasInk] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [dirty, setDirty] = useState(true) // changed since the last hand-in
  const [reason, setReason] = useState<UnreadableReason | null>(null)
  const [error, setError] = useState<string | null>(null)

  function save(answer: { value?: string; selected?: number[] }) {
    onStatus('saving')
    setError(null)
    const work = chain.current.then(() =>
      submitExamAnswer(sessionId, exercise.id, answer).then(
        () => onStatus('saved'),
        (e: unknown) => {
          onStatus('error')
          setError(
            e instanceof Error && e.message.includes('over')
              ? 'Die Prüfungszeit ist abgelaufen.'
              : 'Deine Antwort konnte nicht gespeichert werden. Versuch es noch einmal.',
          )
        },
      ),
    )
    chain.current = work
    track(work)
  }

  function handIn() {
    const image = mode === 'photo' ? photo : canvasRef.current?.toImage()
    if (!image) return
    onStatus('grading')
    setDirty(false)
    setReason(null)
    setError(null)
    const work = gradeExamHandwriting({ sessionId, exerciseId: exercise.id, image, kind: mode })
      .then((r) => {
        if (r.status === 'saved') return onStatus('saved')
        setReason(r.reason)
        setDirty(true)
        onStatus('unreadable')
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Die Abgabe hat nicht geklappt.')
        setDirty(true)
        onStatus('error')
      })
    track(work)
    onSubmitted()
  }

  const changed = () => {
    setDirty(true)
    if (status === 'unreadable') setReason(null)
  }
  const canHandIn = (mode === 'photo' ? photo !== null : hasInk) && dirty && status !== 'grading'

  return (
    <section
      hidden={!active}
      aria-labelledby={`task-${exercise.id}`}
      className="flex flex-col gap-5"
    >
      <div>
        <h2 id={`task-${exercise.id}`} className="text-h3">
          Aufgabe {number}
        </h2>
        <div className="text-prose measure mt-1">
          <RichText text={exercise.prompt} />
        </div>
        {exercise.diagram && <DiagramView diagram={exercise.diagram} />}
      </div>

      {choice ? (
        <div>
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Antwortmöglichkeiten</legend>
            {(exercise.presentation.options ?? []).map((option, i) => {
              const isSelected = selected.includes(i)
              return (
                <label
                  key={i}
                  className={cn(
                    'bg-background flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 p-3',
                    isSelected && 'border-primary',
                  )}
                >
                  <input
                    type={multi ? 'checkbox' : 'radio'}
                    name={`option-${exercise.id}`}
                    className="accent-primary size-5 shrink-0"
                    checked={isSelected}
                    onChange={() => {
                      const next = multi
                        ? isSelected
                          ? selected.filter((x) => x !== i)
                          : [...selected, i]
                        : [i]
                      setSelected(next)
                      save({ selected: next })
                    }}
                  />
                  <RichText text={option} />
                </label>
              )
            })}
          </fieldset>
        </div>
      ) : (
        <GridPaper as="div" raised contentClassName={handwriting ? 'p-0' : 'py-4'}>
          {handwriting ? (
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v === 'photo' ? 'photo' : 'drawing')}
              className="gap-0"
            >
              <div className="border-b p-2">
                <TabsList aria-label="Wie gibst du deine Lösung ab?" className="h-auto">
                  <TabsTrigger value="drawing" className="min-h-11 px-4">
                    <Pencil aria-hidden="true" />
                    Zeichnen
                  </TabsTrigger>
                  <TabsTrigger value="photo" className="min-h-11 px-4">
                    <Camera aria-hidden="true" />
                    Foto
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="drawing" keepMounted className="text-base">
                <HandwritingCanvas
                  ref={canvasRef}
                  disabled={status === 'grading'}
                  onChange={(ink) => {
                    setHasInk(ink)
                    changed()
                  }}
                />
              </TabsContent>
              <TabsContent value="photo" keepMounted className="text-base">
                <PhotoInput
                  disabled={status === 'grading'}
                  onChange={(image) => {
                    setPhoto(image)
                    changed()
                  }}
                />
              </TabsContent>
            </Tabs>
          ) : exercise.type === 'numeric' ? (
            <div className="flex flex-wrap items-center gap-3">
              <Input
                aria-label="Deine Antwort"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Deine Antwort"
                className="bg-background max-w-48"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (status === 'saved') onStatus('open')
                }}
              />
              {exercise.presentation.unit && (
                <span className="text-muted-foreground">{exercise.presentation.unit}</span>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={value.trim() === '' || status === 'saving'}
                onClick={() => save({ value })}
              >
                Speichern
              </Button>
            </div>
          ) : null}
        </GridPaper>
      )}

      {handwriting && exercise.presentation.unit && (
        <p className="text-fine text-muted-foreground -mt-3">
          Schreib dein Ergebnis zum Schluss mit der Einheit {exercise.presentation.unit} auf.
        </p>
      )}

      <div role="status" className="empty:hidden">
        {status === 'unreadable' && reason && (
          <MarginNote status="unreadable">
            Nicht lesbar – gib diese Aufgabe nochmal ab.
            <span className="text-fine text-muted-foreground block font-sans font-normal">
              {unreadableTips[reason]}
            </span>
          </MarginNote>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}

      {handwriting && (
        <div>
          <Button type="button" disabled={!canHandIn} onClick={handIn}>
            {status === 'grading'
              ? 'Wird gelesen …'
              : status === 'saved' && !dirty
                ? 'Abgegeben'
                : status === 'saved' || status === 'unreadable' || status === 'error'
                  ? 'Erneut abgeben'
                  : 'Abgeben und weiter'}
          </Button>
        </div>
      )}
    </section>
  )
}
