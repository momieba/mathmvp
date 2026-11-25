import { Link, useNavigate, useParams } from 'react-router'
import { AppHeader } from '@/components/layout/AppHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { stageLabels } from '@/features/curriculum/labels'
import { buttonClass } from '@/lib/buttonClass'
import {
  useAddTopic,
  useMyTopics,
  usePrerequisites,
  useProgress,
  usePublishedVideos,
  useRemoveTopic,
  useTopic,
} from './api'
import { ExamSection } from './exam/ExamSection'
import { RecommendationNote } from './RecommendationNote'
import { recommend } from './recommendations'
import { ScoreBar } from './ScoreBar'
import { topicProgress } from './score'

/** Detail view of one topic: overall progress, exam, and the learning path with its sections. */
export function TopicPage() {
  const { slug = '' } = useParams()
  const topic = useTopic(slug)
  const myTopics = useMyTopics()
  const progress = useProgress()
  const add = useAddTopic()
  const remove = useRemoveTopic()
  const navigate = useNavigate()

  const data = topic.data
  const subtopicIds = data?.subtopics.map((s) => s.id) ?? []
  const prerequisites = usePrerequisites(subtopicIds)
  const videos = usePublishedVideos([
    ...subtopicIds,
    ...[...(prerequisites.data?.values() ?? [])].flat().map((p) => p.id),
  ])
  const added = !!data && !!myTopics.data?.some((t) => t.id === data.id)
  const total = data
    ? topicProgress(
        data.subtopics.map((s) => s.id),
        progress.data,
      )
    : null

  return (
    <PageShell header={<AppHeader back={{ to: '/app', label: 'Meine Themen' }} />}>
      {topic.isPending ? (
        <p role="status" className="text-muted-foreground">
          Das Thema wird geladen …
        </p>
      ) : topic.error ? (
        <p role="alert" className="text-destructive">
          Das Thema konnte nicht geladen werden. Lade die Seite neu.
        </p>
      ) : !data ? (
        <div role="alert">
          <h1 className="text-h2">Dieses Thema gibt es nicht.</h1>
          <Link to="/app" className={buttonClass({ variant: 'outline' }, 'mt-4')}>
            Zu meinen Themen
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <section>
            <h1 className="text-title">{data.title}</h1>
            <p className="text-muted-foreground measure mt-2">{data.description}</p>
            {total && (
              <ScoreBar score={total.score} attemptCount={total.attemptCount} className="mt-4" />
            )}
          </section>

          <ExamSection topicId={data.id} topicSlug={data.slug} />

          <section aria-labelledby="path-heading">
            <h2 id="path-heading" className="text-h2 mb-4">
              Abschnitte
            </h2>
            <ol className="border-b">
              {data.subtopics.map((s) => {
                const p = progress.data?.get(s.id)
                const recommendation = progress.data
                  ? recommend({
                      subtopicId: s.id,
                      progress: progress.data,
                      prerequisites: prerequisites.data?.get(s.id) ?? [],
                      videos: videos.data,
                    })
                  : null
                return (
                  <li key={s.id} className="flex flex-col gap-2 border-t py-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span className="font-medium">{s.title}</span>
                        <span className="text-muted-foreground text-fine shrink-0">
                          {stageLabels[s.stage]}
                        </span>
                        <span
                          aria-hidden="true"
                          className="mb-1 hidden min-w-4 flex-1 self-end border-b-2 border-dotted sm:block"
                        />
                      </div>
                      <ScoreBar
                        score={p?.score ?? 0}
                        attemptCount={p?.attemptCount ?? 0}
                        className="sm:w-72"
                      />
                      <Link
                        to={`/app/ueben/${s.slug}`}
                        className={buttonClass({ variant: 'outline' }, 'shrink-0')}
                      >
                        Üben
                      </Link>
                    </div>
                    {recommendation && (
                      <RecommendationNote recommendation={recommendation} compact />
                    )}
                  </li>
                )
              })}
            </ol>
          </section>

          <div>
            {added ? (
              <Button
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate(data.id, { onSuccess: () => void navigate('/app') })}
              >
                Aus meinen Themen entfernen
              </Button>
            ) : (
              myTopics.data && (
                <Button disabled={add.isPending} onClick={() => add.mutate(data.id)}>
                  Zu meinen Themen hinzufügen
                </Button>
              )
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}
