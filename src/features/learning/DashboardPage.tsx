import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AppHeader, ProfileLink } from '@/components/layout/AppHeader'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signOut } from '@/features/auth/api'
import { AUTH_ENABLED } from '@/features/auth/config'
import { schoolTypeLabels, stateLabels } from '@/features/curriculum/labels'
import { useProfile } from '@/features/profile/api'
import { buttonClass } from '@/lib/buttonClass'
import {
  useAddTopic,
  useMyTopics,
  useProgress,
  useRemoveTopic,
  useTopicSearch,
  type MyTopic,
  type SubtopicProgress,
} from './api'
import { ScoreBar } from './ScoreBar'

const stageLabels = {
  einstieg: 'Einstieg',
  grundlagen: 'Grundlagen',
  vertiefung: 'Vertiefung',
  anwendung: 'Anwendung',
} as const

function useDebounced<T>(value: T, ms = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function DashboardPage() {
  const { data: profile } = useProfile()
  const myTopics = useMyTopics()
  const progress = useProgress()

  return (
    <PageShell
      header={
        <AppHeader
          actions={
            <>
              <ProfileLink />
              {AUTH_ENABLED && (
                <Button variant="ghost" onClick={() => void signOut()}>
                  Abmelden
                </Button>
              )}
            </>
          }
        />
      }
    >
      <div className="flex flex-col gap-10">
        <section>
          <h1 className="text-title">
            Hallo{profile?.display_name ? ` ${profile.display_name}` : ''}
          </h1>
          {profile?.state && profile.school_type && (
            <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4">
              <span>
                Klasse {profile.grade}, {schoolTypeLabels[profile.school_type]},{' '}
                {stateLabels[profile.state]}
              </span>
              <Link
                to="/profil"
                className="text-primary inline-flex min-h-11 items-center underline underline-offset-4"
              >
                Ändern
              </Link>
            </p>
          )}
        </section>

        <TopicSearch addedIds={new Set(myTopics.data?.map((t) => t.id))} />

        {/* Platz für „Weiter, wo du warst“ (Lernpfad-Einstieg, Etappe 5) – steht über „Meine Themen“. */}
        <section aria-labelledby="my-topics">
          <h2 id="my-topics" className="text-h2 mb-4">
            Meine Themen
          </h2>
          {myTopics.isPending ? (
            <p role="status" className="text-muted-foreground">
              Deine Themen werden geladen …
            </p>
          ) : myTopics.error ? (
            <p role="alert" className="text-destructive">
              Deine Themen konnten nicht geladen werden. Lade die Seite neu.
            </p>
          ) : myTopics.data.length === 0 ? (
            <p className="text-prose border-y py-6">
              Noch keine Themen. Such dein erstes Thema, z. B. Brüche.
            </p>
          ) : (
            <ul className="divide-y border-y">
              {myTopics.data.map((topic) => (
                <TopicBlock key={topic.id} topic={topic} progress={progress.data} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  )
}

function TopicSearch({ addedIds }: { addedIds: Set<string> }) {
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query)
  const search = useTopicSearch(debounced)
  const add = useAddTopic()
  const showResults = debounced.trim().length >= 2

  return (
    <section aria-label="Thema suchen">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground absolute top-1/2 left-4 size-5 -translate-y-1/2"
        />
        <Input
          type="search"
          aria-label="Thema suchen"
          placeholder="Thema suchen, z. B. „Pythagoras“"
          className="text-prose h-14 pl-12"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="mt-3 empty:hidden" aria-live="polite">
        {showResults &&
          (search.isPending ? (
            <p className="text-muted-foreground">Suche …</p>
          ) : search.error ? (
            <p role="alert" className="text-destructive">
              Die Suche hat nicht geklappt. Versuch es noch einmal.
            </p>
          ) : search.data && search.data.length > 0 ? (
            <ul className="divide-y border-y">
              {search.data.map((hit) => {
                const added = addedIds.has(hit.topic_id)
                return (
                  <li key={hit.topic_id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{hit.title}</p>
                      <p className="text-muted-foreground text-fine">
                        {hit.matched !== hit.title ? `Enthält: ${hit.matched}` : hit.description}
                      </p>
                    </div>
                    <Button
                      variant={added ? 'secondary' : 'default'}
                      disabled={added || add.isPending}
                      onClick={() => add.mutate(hit.topic_id)}
                    >
                      {added ? 'Hinzugefügt' : 'Hinzufügen'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Kein Thema gefunden. Versuch es mit einem anderen Begriff.
            </p>
          ))}
      </div>
    </section>
  )
}

/** One topic as a table-of-contents entry: title, overall progress, then its sections as ruled rows. */
function TopicBlock({
  topic,
  progress,
}: {
  topic: MyTopic
  progress: Map<string, SubtopicProgress> | undefined
}) {
  const remove = useRemoveTopic()
  const scores = topic.subtopics.map((s) => progress?.get(s.id))
  const total =
    topic.subtopics.length === 0
      ? 0
      : Math.round(scores.reduce((sum, p) => sum + (p?.score ?? 0), 0) / topic.subtopics.length)
  const attempts = scores.reduce((sum, p) => sum + (p?.attemptCount ?? 0), 0)

  return (
    <li className="py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-h3">{topic.title}</h3>
          <p className="text-muted-foreground text-fine measure mt-1">{topic.description}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mt-2 -mr-2"
          aria-label={`${topic.title} aus meinen Themen entfernen`}
          onClick={() => remove.mutate(topic.id)}
        >
          <X aria-hidden="true" className="size-5" />
        </Button>
      </div>
      <ScoreBar score={total} attemptCount={attempts} className="mt-4" />
      <ol className="mt-4">
        {topic.subtopics.map((s, i) => {
          const p = scores[i]
          return (
            <li
              key={s.id}
              className="flex flex-col gap-1 border-t py-3 sm:flex-row sm:items-center sm:gap-3"
            >
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
            </li>
          )
        })}
      </ol>
    </li>
  )
}
