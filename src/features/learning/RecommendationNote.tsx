import { PlayCircle, RotateCcw } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { buttonClass } from '@/lib/buttonClass'
import { cn } from '@/lib/utils'
import type { Recommendation, VideoRef } from './recommendations'

function VideoLink({ video }: { video: VideoRef }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass({ variant: 'outline' })}
    >
      <PlayCircle aria-hidden="true" />
      Video ansehen
      <span className="sr-only"> (öffnet in neuem Tab)</span>
    </a>
  )
}

/** Suggestion to review: weakest prerequisite first, otherwise the video or the basics. */
export function RecommendationNote({
  recommendation: r,
  onDismiss,
  compact = false,
  className,
}: {
  recommendation: Recommendation
  onDismiss?: () => void
  /** Short form for lists (topic page). */
  compact?: boolean
  className?: string
}) {
  const text =
    r.kind === 'prerequisite' ? (
      <>
        {compact ? 'Erst ' : 'Hier hakt es noch. Wiederhole zuerst '}„{r.subtopic.title}“
        {compact ? ' wiederholen' : ' – darauf baut dieser Abschnitt auf.'}
      </>
    ) : compact ? (
      r.video ? (
        'Video nochmal ansehen'
      ) : (
        'Wiederholen empfohlen'
      )
    ) : r.video ? (
      <>
        Hier hakt es noch. Schau dir das Video „{r.video.title}“ nochmal an und versuch es dann
        wieder.
      </>
    ) : (
      'Hier hakt es noch. Lies dir die Musterlösung Schritt für Schritt durch und nimm beim nächsten Mal ruhig einen Hinweis.'
    )

  return (
    <aside
      aria-label="Wiederholen empfohlen"
      className={cn(
        'bg-marker text-marker-foreground flex gap-3 rounded-lg',
        compact ? 'items-center p-2' : 'p-3',
        className,
      )}
    >
      <RotateCcw aria-hidden="true" className={cn('size-5 shrink-0', !compact && 'mt-1')} />
      <div className={'flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2'}>
        <p className={cn(compact ? 'text-fine' : 'w-full')}>{text}</p>
        {r.kind === 'prerequisite' && (
          <Link
            to={`/app/ueben/${r.subtopic.slug}`}
            className={buttonClass({ variant: 'outline' })}
          >
            {compact ? 'Üben' : `„${r.subtopic.title}“ üben`}
          </Link>
        )}
        {r.video && <VideoLink video={r.video} />}
        {onDismiss && (
          <Button type="button" variant="ghost" className="min-h-11" onClick={onDismiss}>
            Ausblenden
          </Button>
        )}
      </div>
    </aside>
  )
}
