import { Check, Clock, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AppHeader } from '@/components/layout/AppHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { buttonClass } from '@/lib/buttonClass'
import { cn } from '@/lib/utils'
import { useTopic, type TopicDetail } from '../api'
import { useExamExercises, useStartExam, type ExamStart } from './api'
import { EXAM_MINUTES, EXAM_TASKS } from './examGrade'
import { ExamResultView } from './ExamResultView'
import { ExamTask, type TaskStatus } from './ExamTask'

/** `/app/thema/:slug/pruefung` runs an exam, `/app/thema/:slug/pruefung/:sessionId` shows its result. */
export function ExamPage() {
  const { slug = '', sessionId } = useParams()
  const topic = useTopic(slug)

  return (
    <PageShell
      width="wide"
      header={
        <AppHeader
          width="wide"
          back={{
            to: `/app/thema/${slug}`,
            label: topic.data?.title ?? 'Zum Thema',
          }}
        />
      }
    >
      {topic.isPending ? (
        <p role="status" className="text-muted-foreground">
          Wird geladen …
        </p>
      ) : !topic.data ? (
        <div role="alert">
          <h1 className="text-h2">Dieses Thema gibt es nicht.</h1>
          <Link to="/app" className={buttonClass({ variant: 'outline' }, 'mt-4')}>
            Zu meinen Themen
          </Link>
        </div>
      ) : sessionId ? (
        <ExamResultView key={sessionId} sessionId={sessionId} topic={topic.data} />
      ) : (
        <ExamRunner topic={topic.data} />
      )}
    </PageShell>
  )
}

function ExamRunner({ topic }: { topic: TopicDetail }) {
  const start = useStartExam()
  const navigate = useNavigate()

  if (start.data) {
    return (
      <ExamRun
        start={start.data}
        topicTitle={topic.title}
        onFinish={() =>
          void navigate(`/app/thema/${topic.slug}/pruefung/${start.data.id}`, { replace: true })
        }
      />
    )
  }

  return (
    <div className="measure flex flex-col gap-4">
      <h1 className="text-title">Prüfung: {topic.title}</h1>
      <ul className="text-prose list-disc space-y-1 pl-6">
        <li>bis zu {EXAM_TASKS} Aufgaben aus allen Abschnitten, von leicht nach schwer</li>
        <li>{EXAM_MINUTES} Minuten Zeit – die Uhr läuft auch weiter, wenn du die Seite schließt</li>
        <li>keine Hinweise und keine Lösungen während der Prüfung</li>
        <li>Rechenwege schreibst du wie beim Üben auf; sie werden im Hintergrund korrigiert</li>
        <li>am Ende bekommst du eine Note und siehst alle Musterlösungen</li>
      </ul>
      {start.error && (
        <p role="alert" className="text-destructive">
          {start.error.message.includes('no exercises')
            ? 'Für dieses Thema gibt es noch keine Aufgaben für eine Prüfung.'
            : 'Die Prüfung konnte nicht gestartet werden. Versuch es noch einmal.'}
        </p>
      )}
      <div>
        <Button className="px-6" disabled={start.isPending} onClick={() => start.mutate(topic.id)}>
          {start.isPending ? 'Wird vorbereitet …' : 'Prüfung starten'}
        </Button>
      </div>
    </div>
  )
}

function formatTime(ms: number) {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const statusText: Record<TaskStatus, string> = {
  open: 'offen',
  saving: 'wird gespeichert',
  saved: 'beantwortet',
  grading: 'wird gelesen',
  unreadable: 'nicht lesbar',
  error: 'nicht gespeichert',
}

function ExamRun({
  start,
  topicTitle,
  onFinish,
}: {
  start: ExamStart
  topicTitle: string
  onFinish: () => void
}) {
  const exercises = useExamExercises(start.exerciseIds)
  // Remaining time follows the server clock (the deadline is checked there as well).
  const [offset] = useState(() => new Date(start.serverNow).getTime() - Date.now())
  const deadline = new Date(start.deadlineAt).getTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const remaining = Math.max(0, deadline - (now + offset))

  const [status, setStatus] = useState<Record<string, TaskStatus>>(() =>
    Object.fromEntries(start.answeredIds.map((id) => [id, 'saved' as const])),
  )
  const [index, setIndex] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const pending = useRef(new Set<Promise<unknown>>())
  const finished = useRef(false)

  const track = useCallback((work: Promise<unknown>) => {
    pending.current.add(work)
    void work.finally(() => pending.current.delete(work))
  }, [])

  const finish = useCallback(async () => {
    if (finished.current) return
    finished.current = true
    setFinishing(true)
    // answers still being saved/graded must land before the exam is submitted
    await Promise.allSettled([...pending.current])
    onFinish()
  }, [onFinish])

  const timeUp = remaining === 0
  useEffect(() => {
    if (timeUp) void finish()
  }, [timeUp, finish])

  const list = exercises.data ?? []
  const answered = list.filter((e) => status[e.id] === 'saved').length
  const busy = list.some((e) => status[e.id] === 'grading' || status[e.id] === 'saving')

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-background/95 sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <h1 className="text-h3 min-w-0 truncate">Prüfung: {topicTitle}</h1>
        <p
          className={cn(
            'flex items-center gap-2 font-semibold tabular-nums',
            remaining < 5 * 60_000 && 'text-wrong',
          )}
          aria-live={remaining < 5 * 60_000 ? 'polite' : 'off'}
        >
          <Clock aria-hidden="true" className="size-5" />
          <span className="sr-only">Verbleibende Zeit: </span>
          {formatTime(remaining)}
        </p>
      </div>

      {exercises.isPending ? (
        <p role="status" className="text-muted-foreground">
          Die Aufgaben werden geladen …
        </p>
      ) : exercises.error ? (
        <p role="alert" className="text-destructive">
          Die Aufgaben konnten nicht geladen werden. Lade die Seite neu – deine Antworten bleiben
          gespeichert.
        </p>
      ) : finishing ? (
        <p role="status" className="text-muted-foreground flex items-center gap-2">
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
          {timeUp ? 'Die Zeit ist um. ' : ''}Deine Prüfung wird ausgewertet …
        </p>
      ) : (
        <>
          <nav aria-label="Aufgaben">
            <ol className="flex flex-wrap gap-2">
              {list.map((e, i) => {
                const s = status[e.id] ?? 'open'
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-current={i === index ? 'step' : undefined}
                      aria-label={`Aufgabe ${i + 1}, ${statusText[s]}`}
                      className={cn(
                        'bg-background flex size-11 items-center justify-center gap-1 rounded-lg border-2 font-semibold tabular-nums',
                        i === index && 'border-primary ring-primary/30 ring-2',
                        s === 'saved' && 'text-correct',
                        (s === 'unreadable' || s === 'error') && 'text-wrong',
                      )}
                    >
                      {i + 1}
                      {s === 'saved' && <Check aria-hidden="true" className="size-3.5" />}
                      {(s === 'grading' || s === 'saving') && (
                        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                      )}
                      {(s === 'unreadable' || s === 'error') && (
                        <TriangleAlert aria-hidden="true" className="size-3.5" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          {list.map((e, i) => (
            <ExamTask
              key={e.id}
              exercise={e}
              number={i + 1}
              sessionId={start.id}
              active={i === index}
              status={status[e.id] ?? 'open'}
              onStatus={(s) => setStatus((prev) => ({ ...prev, [e.id]: s }))}
              track={track}
              onSubmitted={() =>
                setIndex((cur) => (cur === i ? Math.min(i + 1, list.length - 1) : cur))
              }
            />
          ))}

          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              Zurück
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={index >= list.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              Weiter
            </Button>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {confirming ? (
                <>
                  <span className="text-fine" role="status">
                    {answered} von {list.length} beantwortet
                    {busy ? ', einige werden noch gelesen' : ''}. Wirklich abgeben?
                  </span>
                  <Button type="button" onClick={() => void finish()}>
                    Ja, abgeben
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                    Weiter bearbeiten
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => setConfirming(true)}>
                  Prüfung abgeben
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
