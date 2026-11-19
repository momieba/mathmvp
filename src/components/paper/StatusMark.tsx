import { statusConfig, type Status } from './status'
import { cn } from '@/lib/utils'

/**
 * Round status mark: icon in a circle plus a text label – status is never carried by color alone.
 * `compact` keeps the label for screen readers only (use when the text is shown right next to it).
 */
export function StatusMark({
  status,
  compact = false,
  className,
}: {
  status: Status
  compact?: boolean
  className?: string
}) {
  const { icon: Icon, label, color } = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center gap-2 font-medium', color, className)}>
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-full border-2"
      >
        <Icon className="size-4" strokeWidth={3} />
      </span>
      <span className={compact ? 'sr-only' : undefined}>{label}</span>
    </span>
  )
}
