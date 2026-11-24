import { useState } from 'react'
import { Link } from 'react-router'
import { buttonClass } from '@/lib/buttonClass'
import { useExamHistory } from './api'
import { EXAM_MINUTES, EXAM_TASKS, gradeFor, gradeLabels, percentOf } from './examGrade'

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

/** Exam entry on the topic page: rules, start/resume, past grades. */
export function ExamSection({ topicId, topicSlug }: { topicId: string; topicSlug: string }) {
  const history = useExamHistory(topicId)
  const [now] = useState(() => Date.now())
  const open = history.data?.find(
    (s) => s.submittedAt === null && new Date(s.deadlineAt).getTime() > now,
  )
  const past = history.data?.filter((s) => s !== open) ?? []

  return (
    <section aria-labelledby="exam-heading" className="rounded-lg border-2 p-4 sm:p-5">
      <h2 id="exam-heading" className="text-h2">
        Prüfung
      </h2>
      <p className="text-muted-foreground measure mt-1">
        {EXAM_TASKS} Aufgaben aus allen Abschnitten, {EXAM_MINUTES} Minuten, ohne Hinweise. Am Ende
        bekommst du eine Note und siehst die Musterlösungen.
      </p>
      <Link to={`/app/thema/${topicSlug}/pruefung`} className={buttonClass({}, 'mt-4')}>
        {open ? 'Laufende Prüfung fortsetzen' : 'Prüfung starten'}
      </Link>

      {past.length > 0 && (
        <>
          <h3 className="text-fine text-muted-foreground mt-6 font-sans font-normal">
            Deine letzten Prüfungen
          </h3>
          <ul className="mt-2 border-b">
            {past.map((s) => {
              const graded = s.submittedAt !== null && s.points !== null
              const percent = graded ? percentOf(s.points!, s.maxPoints) : 0
              const grade = gradeFor(percent)
              return (
                <li key={s.id} className="border-t">
                  <Link
                    to={`/app/thema/${topicSlug}/pruefung/${s.id}`}
                    className="flex min-h-11 items-center justify-between gap-4 py-2 underline-offset-4 hover:underline"
                  >
                    <span>{dateFormat.format(new Date(s.startedAt))}</span>
                    {graded ? (
                      <span className="tabular-nums">
                        <strong className="font-semibold">Note {grade}</strong>{' '}
                        <span className="text-muted-foreground">
                          ({gradeLabels[grade]}, {percent} %)
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Zeit abgelaufen – auswerten</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
