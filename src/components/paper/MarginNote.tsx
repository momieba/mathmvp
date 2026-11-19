import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { statusConfig, type Status } from './status'
import { StatusMark } from './StatusMark'

/**
 * Correction in the margin, written like a teacher: status mark + short comment in Casual script.
 * `index` orders the draw-in animation top to bottom (`animate`, plays once, off for reduced motion).
 * `step` adds a "Schritt n" prefix – used for the list below the sheet on small screens.
 */
export function MarginNote({
  status,
  children,
  step,
  index = 0,
  animate = false,
  className,
}: {
  status: Status
  children?: ReactNode
  step?: number
  index?: number
  animate?: boolean
  className?: string
}) {
  const { color } = statusConfig[status]
  return (
    <div
      data-status={status}
      className={cn('flex items-start gap-2', animate && 'margin-animate', className)}
      style={{ '--i': index } as CSSProperties}
    >
      <StatusMark
        status={status}
        compact={children !== undefined}
        className={cn('casual', children !== undefined && 'mt-0.5')}
      />
      {children !== undefined && (
        <p className={cn('casual text-ui min-w-0 pt-1 leading-snug', color)}>
          {step !== undefined && <span className="font-normal">Schritt {step}: </span>}
          {children}
        </p>
      )}
    </div>
  )
}
