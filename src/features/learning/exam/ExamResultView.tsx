import { Link } from 'react-router'
import { DiagramView } from '@/components/math/DiagramView'
import { RichText } from '@/components/math/RichText'
import { GridPaper } from '@/components/paper/GridPaper'
import { StatusMark } from '@/components/paper/StatusMark'
import { useProfile } from '@/features/profile/api'
import { buttonClass } from '@/lib/buttonClass'
import type { PracticeExercise, TopicDetail } from '../api'
import { HandwritingNotes, ResultNote, Solution } from '../Feedback'
import { useExamExercises, useExamResult, type ExamTaskResult } from './api'
import { gradeFor, gradeLabels, oberstufePointsFor, percentOf } from './examGrade'

const formatPoints = (n: number) => String(n).replace('.', ',')

/** Result of a submitted exam: grade, points, and per task the correction plus model solution. */
export function ExamResultView({ sessionId, topic }: { sessionId: string; topic: TopicDetail }) {
  const result = useExamResult(sessionId, topic.id)
  const exercises = useExamExercises(result.data?.tasks.map((t) => t.exerciseId))
  const profile = useProfile()

  if (result.isPending || (result.data && exercises.isPending)) {
    return (
      <p role="status" className="text-muted-foreground">
        Deine Prüfung wird ausgewertet …
      </p>
    )
  }
  if (result.error || !result.data) {
    return (
      <p role="alert" className="text-destructive">
        Das Ergebnis konnte nicht geladen werden. Lade die Seite neu.
      </p>
    )
  }

  const r = result.data
  const percent = percentOf(r.points, r.maxPoints)
  const grade = gradeFor(percent)
  const oberstufe = (profile.data?.grade ?? 0) >= 11
  const minutes = Math.max(
    1,
    Math.round((new Date(r.submittedAt).getTime() - new Date(r.startedAt).getTime()) / 60_000),
  )
  const byId = new Map(exercises.data?.map((e) => [e.id, e]))

  return (
    <div className="flex flex-col gap-8">
      <GridPaper as="section" raised aria-labelledby="grade-heading" contentClassName="py-6">
        <p className="text-muted-foreground">Prüfung: {topic.title}</p>
        <h1 id="grade-heading" className="casual mt-1 text-5xl font-semibold">
          Note {grade}
          <span className="text-h3 text-muted-foreground ml-3 font-normal">
            {gradeLabels[grade]}
          </span>
        </h1>
        <p className="text-prose mt-3 tabular-nums">
          {formatPoints(r.points)} von {r.maxPoints} Punkten ({percent} %)
          {oberstufe && <> · {oberstufePointsFor(percent)} Punkte (Oberstufe)</>}
          <span className="text-muted-foreground"> · nach {minutes} Min. abgegeben</span>
        </p>
      </GridPaper>

      <section aria-labelledby="tasks-heading" className="flex flex-col gap-8">
        <h2 id="tasks-heading" className="text-h2">
          Deine Aufgaben
        </h2>
        {r.tasks.map((task, i) => (
          <TaskResult
            key={task.exerciseId}
            task={task}
            number={i + 1}
            exercise={byId.get(task.exerciseId)}
          />
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to={`/app/thema/${topic.slug}/pruefung`} className={buttonClass({})}>
          Neue Prüfung
        </Link>
        <Link to={`/app/thema/${topic.slug}`} className={buttonClass({ variant: 'outline' })}>
          Zurück zum Thema
        </Link>
      </div>
    </div>
  )
}

function TaskResult({
  task,
  number,
  exercise,
}: {
  task: ExamTaskResult
  number: number
  exercise: PracticeExercise | undefined
}) {
  const status = task.points >= 1 ? 'correct' : task.points > 0 ? 'unclear' : 'wrong'
  const verdict = !task.answered
    ? 'nicht bearbeitet'
    : task.points >= 1
      ? 'richtig'
      : task.points > 0
        ? 'Ergebnis richtig, Rechenweg mit Fehler'
        : 'falsch'
  const options = exercise?.presentation.options

  return (
    <article
      aria-labelledby={`result-${task.exerciseId}`}
      className="flex flex-col gap-3 border-t pt-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 id={`result-${task.exerciseId}`} className="text-h3">
          Aufgabe {number}
        </h3>
        <StatusMark status={status} compact />
        <span className="text-fine">
          {verdict} · {formatPoints(task.points)} {task.points === 1 ? 'Punkt' : 'Punkte'}
        </span>
      </div>
      {exercise && (
        <div className="text-prose measure">
          <RichText text={exercise.prompt} />
          {exercise.diagram && <DiagramView diagram={exercise.diagram} />}
        </div>
      )}

      <div className="measure">
        {task.feedback ? (
          <HandwritingNotes
            showWork
            result={{
              status: 'graded',
              correct: task.correct,
              steps: task.feedback.steps,
              final: task.feedback.final,
              summary: task.feedback.summary,
              answer: task.reference,
              solution: task.solution,
            }}
          />
        ) : task.answered && task.answer ? (
          <div className="flex flex-col gap-2">
            <p className="text-fine text-muted-foreground">
              Deine Antwort:{' '}
              {task.answer.selected ? (
                <RichText text={task.answer.selected.map((s) => options?.[s] ?? '?').join(', ')} />
              ) : (
                task.answer.value
              )}
            </p>
            <ResultNote
              result={{ correct: task.correct, answer: task.reference, solution: task.solution }}
            />
          </div>
        ) : null}
      </div>

      <details className="group">
        <summary className="text-primary min-h-11 cursor-pointer py-2 underline-offset-4 hover:underline">
          Musterlösung ansehen
        </summary>
        <Solution result={{ solution: task.solution }} />
      </details>
    </article>
  )
}
