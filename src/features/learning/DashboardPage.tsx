import { Search } from 'lucide-react'
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
import {
  useAddTopic,
  useMyTopics,
  useProgress,
  useTopicSearch,
  type MyTopic,
  type SubtopicProgress,
} from './api'
import { ScoreBar } from './ScoreBar'
import { topicProgress } from './score'

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
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myTopics.data.map((topic) => (
                <TopicTile key={topic.id} topic={topic} progress={progress.data} />
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

/** One topic as a compact tile; the learning path and the exam are on the topic page. */
function TopicTile({
  topic,
  progress,
}: {
  topic: MyTopic
  progress: Map<string, SubtopicProgress> | undefined
}) {
  const total = topicProgress(
    topic.subtopics.map((s) => s.id),
    progress,
  )
  return (
    <li>
      <Link
        to={`/app/thema/${topic.slug}`}
        className="bg-card hover:border-primary focus-visible:ring-ring flex h-full min-h-32 flex-col justify-between gap-4 rounded-lg border-2 p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <span>
          <span className="text-h3 casual block">{topic.title}</span>
          <span className="text-muted-foreground text-fine mt-1 block">
            {total.started} von {topic.subtopics.length} Abschnitten begonnen
          </span>
        </span>
        <ScoreBar score={total.score} attemptCount={total.attemptCount} />
      </Link>
    </li>
  )
}
