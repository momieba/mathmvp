import { cn } from '@/lib/utils'
import { masteryLabels, masteryLevel, type MasteryLevel } from './score'

const levelColor: Record<MasteryLevel, string> = {
  neu: 'bg-muted-foreground/30',
  anfang: 'bg-amber-500',
  ueben: 'bg-sky-500',
  sicher: 'bg-primary',
  gemeistert: 'bg-emerald-600',
}

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
        aria-label={`Fortschritt: ${score} von 100 Punkten`}
        className="bg-secondary h-2 flex-1 overflow-hidden rounded-full"
      >
        <div
          className={cn('h-full rounded-full transition-all', levelColor[level])}
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-muted-foreground w-28 shrink-0 text-right text-xs tabular-nums">
          {masteryLabels[level]} · {score}
        </span>
      )}
    </div>
  )
}
