import { cn } from '@/lib/utils'
import { masteryLabels, masteryLevel } from './score'

/** Progress as number plus a slim bar; the level is always written out (never color only). */
export function ScoreBar({
  score,
  attemptCount,
  className,
  showLabel = true,
}: {
  score: number
  attemptCount: number
  className?: string
  showLabel?: boolean
}) {
  const level = masteryLevel(score, attemptCount)
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-valuetext={`${score} von 100 Punkten, ${masteryLabels[level].toLowerCase()}`}
        aria-label="Fortschritt"
        className="bg-karo h-2 min-w-12 flex-1 overflow-hidden rounded-[2px]"
      >
        <div
          className="bg-primary h-full rounded-[2px] transition-[width]"
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-fine flex min-w-36 shrink-0 items-baseline justify-end gap-2 whitespace-nowrap tabular-nums">
          {level !== 'neu' && <strong className="font-semibold">{score} Punkte</strong>}
          <span className="text-muted-foreground">{masteryLabels[level]}</span>
        </span>
      )}
    </div>
  )
}
