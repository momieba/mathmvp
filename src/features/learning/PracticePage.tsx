import { Lightbulb, Pencil, Camera } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { AppHeader } from '@/components/layout/AppHeader'
import { PageShell } from '@/components/layout/PageShell'
import { DiagramView } from '@/components/math/DiagramView'
import { RichText } from '@/components/math/RichText'
import { GridPaper } from '@/components/paper/GridPaper'
import { MarginNote } from '@/components/paper/MarginNote'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buttonClass } from '@/lib/buttonClass'
import { cn } from '@/lib/utils'
import {
  fetchHint,
  useGradeHandwriting,
  usePracticeExercises,
  usePrerequisites,
  useProgress,
  usePublishedVideos,
  useSubmitAnswer,
  useSubtopic,
  type PracticeExercise,
  type UnreadableReason,
} from './api'
import { HANDWRITING_ENABLED } from './config'
import { HandwritingNotes, ResultNote, Solution, type Result } from './Feedback'
import { marksOf } from './feedbackText'
import { HandwritingCanvas, type HandwritingCanvasHandle } from './HandwritingCanvas'
import { PhotoInput } from './PhotoInput'
import { RecommendationNote } from './RecommendationNote'
import { recommend, wrongStreak, type Recommendation } from './recommendations'
import { ScoreBar } from './ScoreBar'
import { selectExercise } from './selectExercise'

const isHandwritten = (e: Pick<PracticeExercise, 'type'>) =>
  e.type === 'numeric' || e.type === 'handwritten'

const difficultyLabels = {
  leicht: 'leicht',
  mittel: 'mittel',
  schwer: 'schwer',
  sehr_schwer: 'sehr schwer',
} as const

export function PracticePage() {
  const { slug = '' } = useParams()
  // Fresh state per subtopic (recommendations link from one practice page to another).
  return <PracticeView key={slug} slug={slug} />
}

function PracticeView({ slug }: { slug: string }) {
  const subtopic = useSubtopic(slug)
  const exercises = usePracticeExercises(subtopic.data?.id)
  const progress = useProgress()
  const [round, setRound] = useState(0)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [results, setResults] = useState<boolean[]>([]) // this session, oldest first
  const [dismissed, setDismissed] = useState(false)

  const subtopicId = subtopic.data?.id
  const mine = subtopicId ? progress.data?.get(subtopicId) : undefined
  const score = mine?.score ?? 0

  const prerequisites = usePrerequisites(subtopicId ? [subtopicId] : [])
  const prereqList = (subtopicId && prerequisites.data?.get(subtopicId)) || []
  const videos = usePublishedVideos(subtopicId ? [subtopicId, ...prereqList.map((p) => p.id)] : [])
  const recommendation =
    subtopicId && !dismissed && progress.data
      ? recommend({
          subtopicId,
          progress: progress.data,
          prerequisites: prereqList,
          videos: videos.data,
          sessionWrongStreak: wrongStreak(results),
        })
      : null

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

  // Handwriting needs a big sheet (tablets): wide page, task text keeps its reading measure.
  const width = current && HANDWRITING_ENABLED && isHandwritten(current) ? 'wide' : 'reading'
  const topic = subtopic.data?.topics
  return (
    <PageShell
      width={width}
      header={
        <AppHeader
          width={width}
          back={
            topic
              ? { to: `/app/thema/${topic.slug}`, label: topic.title }
              : { to: '/app', label: 'Meine Themen' }
          }
        />
      }
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
            <ExerciseCard
              key={`${current.id}-${round}`}
              exercise={current}
              onNext={next}
              onResult={(correct) => setResults((r) => [...r, correct])}
              recommendation={recommendation}
              onDismissRecommendation={() => setDismissed(true)}
            />
          )}
        </div>
      )}
    </PageShell>
  )
}

function ExerciseCard({
  exercise,
  onNext,
  onResult,
  recommendation,
  onDismissRecommendation,
}: {
  exercise: PracticeExercise
  onNext: () => void
  onResult: (correct: boolean) => void
  /** Shown below the result when the subtopic is shaky. */
  recommendation: Recommendation | null
  onDismissRecommendation: () => void
}) {
  const submit = useSubmitAnswer()
  const grade = useGradeHandwriting()
  const canvasRef = useRef<HandwritingCanvasHandle>(null)
  const [hasInk, setHasInk] = useState(false)
  const [mode, setMode] = useState<'drawing' | 'photo'>('drawing')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoKey, setPhotoKey] = useState(0) // remounts PhotoInput to drop a rejected photo
  const [value, setValue] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [hints, setHints] = useState<string[]>([])
  const [noMoreHints, setNoMoreHints] = useState(false)
  const handwriting = HANDWRITING_ENABLED && isHandwritten(exercise)
  const choice = !handwriting && exercise.type === 'multiple_choice'
  const graded = grade.data?.status === 'graded' ? grade.data : undefined
  const unreadable = grade.data?.status === 'unreadable' ? grade.data : undefined
  const result: Result | undefined = submit.data ?? graded
  const pending = submit.isPending || grade.isPending
  const multi = exercise.presentation.multi === true

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (result) return onNext()
    if (pending) return
    if (handwriting) {
      const image = mode === 'photo' ? photo : canvasRef.current?.toImage()
      if (image) {
        grade.mutate(
          { exerciseId: exercise.id, image, kind: mode },
          {
            onSuccess: (r) => {
              if (r.status === 'graded') onResult(r.correct)
              // The same photo would only be rejected again (and burn the rate limit): ask for a new one.
              if (r.status === 'unreadable' && mode === 'photo') {
                setPhoto(null)
                setPhotoKey((k) => k + 1)
              }
            },
          },
        )
      }
      return
    }
    submit.mutate(
      {
        exerciseId: exercise.id,
        answer: exercise.type === 'numeric' ? { value } : { selected },
      },
      { onSuccess: (r) => onResult(r.correct) },
    )
  }

  async function nextHint() {
    const hint = await fetchHint(exercise.id, hints.length)
    if (hint) setHints((h) => [...h, hint])
    else setNoMoreHints(true)
  }

  const canSubmit = handwriting
    ? mode === 'photo'
      ? photo !== null
      : hasInk
    : exercise.type === 'numeric'
      ? value.trim() !== ''
      : selected.length > 0
  const submitLabel = result
    ? 'Nächste Aufgabe'
    : handwriting
      ? grade.isPending
        ? 'Wird korrigiert …'
        : 'Lösung abgeben'
      : 'Prüfen'

  // Task text; for handwriting it is the top of the sheet, so it sits tight on the squared paper.
  const taskBlock = (
    <section aria-labelledby="task-heading" className={cn(handwriting && 'px-4 py-3')}>
      <h2 id="task-heading" className="text-fine text-muted-foreground font-sans font-normal">
        Aufgabe, {difficultyLabels[exercise.difficulty]}
      </h2>
      <div className="text-prose measure mt-1">
        <RichText text={exercise.prompt} />
      </div>
      {exercise.diagram && <DiagramView diagram={exercise.diagram} />}
      {handwriting && !result && exercise.presentation.unit && (
        <p className="text-fine text-muted-foreground mt-2">
          Schreib dein Ergebnis zum Schluss mit der Einheit {exercise.presentation.unit} auf.
        </p>
      )}
    </section>
  )

  return (
    <form
      onSubmit={onSubmit}
      className={cn('flex flex-col gap-6', handwriting && !result && 'max-md:pb-20')}
    >
      {/* Aufgabe: bei Handschrift oben auf dem Blatt (s. u.), sonst frei über der Antwort */}
      {!handwriting && taskBlock}

      {/* Auswahlaufgabe: nichts zu schreiben, darum kein Blatt. Rechenaufgaben löst du auf dem Blatt mit Rand. */}
      {choice ? (
        <section aria-label="Antwortbereich" className="flex flex-col gap-4">
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
          <div role="status" className="empty:hidden">
            {submit.data ? <ResultNote result={submit.data} /> : null}
          </div>
        </section>
      ) : (
        <GridPaper
          as="section"
          raised
          aria-label="Antwortbereich"
          margin={
            <div role="status" className={cn(handwriting && 'lg:sticky lg:top-4')}>
              {grade.isPending ? (
                <PendingNote />
              ) : unreadable ? (
                <UnreadableNote reason={unreadable.reason} photo={mode === 'photo'} />
              ) : graded ? (
                <HandwritingNotes result={graded} />
              ) : submit.data ? (
                <ResultNote result={submit.data} />
              ) : null}
            </div>
          }
          marginAt={handwriting ? 'lg' : 'md'}
          marginClassName={
            handwriting
              ? 'max-lg:has-[[role=status]:empty]:hidden'
              : 'max-md:has-[[role=status]:empty]:hidden'
          }
          contentClassName={handwriting ? 'p-0' : 'py-4'}
        >
          {handwriting ? (
            <Tabs
              value={mode}
              onValueChange={(v) => {
                setMode(v === 'photo' ? 'photo' : 'drawing')
                if (grade.data?.status === 'unreadable' || grade.error) grade.reset()
              }}
              className="gap-0"
            >
              <div className="bg-background/60 border-b p-2">
                <TabsList aria-label="Wie gibst du deine Lösung ab?" className="h-auto">
                  <TabsTrigger
                    value="drawing"
                    className="min-h-11 px-4"
                    disabled={pending || !!graded}
                  >
                    <Pencil aria-hidden="true" />
                    Zeichnen
                  </TabsTrigger>
                  <TabsTrigger
                    value="photo"
                    className="min-h-11 px-4"
                    disabled={pending || !!graded}
                  >
                    <Camera aria-hidden="true" />
                    Foto
                  </TabsTrigger>
                </TabsList>
              </div>
              {taskBlock}
              {/* Both panels stay mounted so the drawing survives switching to the photo and back. */}
              <TabsContent value="drawing" keepMounted className="text-base">
                <HandwritingCanvas
                  ref={canvasRef}
                  disabled={grade.isPending}
                  readOnly={!!graded}
                  marks={graded && mode === 'drawing' ? marksOf(graded.steps) : undefined}
                  onChange={(ink) => {
                    setHasInk(ink)
                    if (grade.data?.status === 'unreadable' || grade.error) grade.reset()
                  }}
                />
              </TabsContent>
              <TabsContent value="photo" keepMounted className="text-base">
                <PhotoInput
                  key={photoKey}
                  disabled={pending || !!graded}
                  marks={graded && mode === 'photo' ? marksOf(graded.steps) : undefined}
                  onChange={(image) => {
                    setPhoto(image)
                    if (grade.data?.status === 'unreadable' || grade.error) grade.reset()
                  }}
                />
              </TabsContent>
            </Tabs>
          ) : exercise.type === 'numeric' ? (
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
          ) : null}
        </GridPaper>
      )}

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
      {grade.error && (
        <p role="alert" className="text-destructive">
          {grade.error.message}
        </p>
      )}

      {/* Musterlösung: zweites Blatt */}
      {result && <Solution result={result} />}

      {result && recommendation && (
        <RecommendationNote recommendation={recommendation} onDismiss={onDismissRecommendation} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="px-6" disabled={(!result && !canSubmit) || pending}>
          {submitLabel}
        </Button>
        {!result && (
          <Button
            type="button"
            variant="outline"
            disabled={noMoreHints || grade.isPending}
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

/** Progress text while grading; says so when it takes longer than a few seconds. Mounted only while pending. */
function PendingNote({ afterMs = 8000 }: { afterMs?: number }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), afterMs)
    return () => clearTimeout(id)
  }, [afterMs])
  return (
    <p className="casual text-ui text-muted-foreground">
      {slow ? 'Dauert noch einen Moment …' : 'Deine Lösung wird gelesen …'}
    </p>
  )
}

const unreadableTips: Record<UnreadableReason, string> = {
  empty: 'Auf dem Blatt steht noch nichts, das ich lesen kann.',
  illegible: 'Schreib deutlicher, mit etwas mehr Abstand zwischen den Zeilen.',
  off_topic: 'Das sieht nicht nach einer Lösung zu dieser Aufgabe aus.',
  photo_quality: 'Mach das Foto bei gutem Licht, gerade und scharf.',
}

const photoTips: Record<UnreadableReason, string> = {
  empty: 'Auf dem Foto sehe ich noch keinen Rechenweg.',
  illegible: 'Schreib deutlicher oder fotografier näher ran, sodass die Schrift das Bild füllt.',
  off_topic: 'Das sieht nicht nach einer Lösung zu dieser Aufgabe aus.',
  photo_quality:
    'Mach das Foto bei gutem Licht, halte die Kamera gerade über das Blatt und warte, bis das Bild scharf ist.',
}

function UnreadableNote({ reason, photo }: { reason: UnreadableReason; photo: boolean }) {
  return (
    <MarginNote status="unreadable">
      {photo
        ? 'Nicht lesbar – mach ein neues Foto und gib nochmal ab.'
        : 'Nicht lesbar – schreib etwas größer und gib nochmal ab.'}
      <span className="text-fine text-muted-foreground block font-sans font-normal">
        {(photo ? photoTips : unreadableTips)[reason]} Das zählt nicht als Versuch.
      </span>
    </MarginNote>
  )
}
