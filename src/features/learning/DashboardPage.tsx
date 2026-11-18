import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signOut } from '@/features/auth/api'
import { AUTH_ENABLED } from '@/features/auth/config'
import { schoolTypeLabels, stateLabels } from '@/features/curriculum/labels'
import { useProfile } from '@/features/profile/api'
import { cn } from '@/lib/utils'
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
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <span className="font-semibold">Mathe-Training</span>
          <div className="flex gap-1">
            <Link to="/profil" className={buttonVariants({ variant: 'ghost' })}>
              Profil
            </Link>
            {AUTH_ENABLED && (
              <Button variant="ghost" onClick={() => void signOut()}>
                Abmelden
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <section>
          <h1 className="text-2xl font-bold tracking-tight">
            Hallo{profile?.display_name ? `, ${profile.display_name}` : ''}!
          </h1>
          {profile?.state && profile.school_type && (
            <p className="text-muted-foreground mt-1 text-sm">
              {schoolTypeLabels[profile.school_type]} · Klasse {profile.grade} ·{' '}
              {stateLabels[profile.state]}
            </p>
          )}
        </section>

        <TopicSearch addedIds={new Set(myTopics.data?.map((t) => t.id))} />

        <section aria-labelledby="my-topics">
          <h2 id="my-topics" className="mb-4 text-lg font-semibold">
            Meine Themen
          </h2>
          {myTopics.isPending ? (
            <p className="text-muted-foreground">Lädt …</p>
          ) : myTopics.error ? (
            <p role="alert" className="text-destructive">
              Deine Themen konnten nicht geladen werden.
            </p>
          ) : myTopics.data.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center">
              Noch keine Themen. Such oben nach einem Thema, das du üben möchtest – zum Beispiel
              „Pythagoras“.
            </p>
          ) : (
            <ul className="grid gap-4">
              {myTopics.data.map((topic) => (
                <TopicCard key={topic.id} topic={topic} progress={progress.data} />
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function TopicSearch({ addedIds }: { addedIds: Set<string> }) {
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query)
  const search = useTopicSearch(debounced)
  const add = useAddTopic()
  const showResults = debounced.trim().length >= 2

  return (
    <section aria-labelledby="search-heading" className="bg-card rounded-xl border p-4 sm:p-6">
      <h2 id="search-heading" className="mb-3 font-semibold">
        Was möchtest du lernen?
      </h2>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          aria-label="Thema suchen"
          placeholder="Thema suchen, z. B. Pythagoras, Brüche, lineare Funktionen …"
          className="h-10 pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {showResults && (
        <div className="mt-3" aria-live="polite">
          {search.isPending ? (
            <p className="text-muted-foreground text-sm">Suche …</p>
          ) : search.error ? (
            <p role="alert" className="text-destructive text-sm">
              Die Suche hat nicht geklappt.
            </p>
          ) : search.data && search.data.length > 0 ? (
            <ul className="divide-y">
              {search.data.map((hit) => {
                const added = addedIds.has(hit.topic_id)
                return (
                  <li key={hit.topic_id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{hit.title}</p>
                      <p className="text-muted-foreground truncate text-sm">
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
            <p className="text-muted-foreground text-sm">
              Kein Thema gefunden. Versuch es mit einem anderen Begriff.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function TopicCard({
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
    <li className="bg-card rounded-xl border p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{topic.title}</h3>
          <p className="text-muted-foreground text-sm">{topic.description}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${topic.title} aus meinen Themen entfernen`}
          onClick={() => remove.mutate(topic.id)}
        >
          <X className="size-4" />
        </Button>
      </div>
      <ScoreBar score={total} attemptCount={attempts} className="mt-4" />
      <ol className="mt-4 divide-y border-t">
        {topic.subtopics.map((s, i) => {
          const p = scores[i]
          return (
            <li
              key={s.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 sm:w-1/2">
                <p className="truncate text-sm font-medium">{s.title}</p>
                <p className="text-muted-foreground text-xs">{stageLabels[s.stage]}</p>
              </div>
              <ScoreBar
                score={p?.score ?? 0}
                attemptCount={p?.attemptCount ?? 0}
                className="flex-1"
              />
              <Link
                to={`/app/ueben/${s.slug}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
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
