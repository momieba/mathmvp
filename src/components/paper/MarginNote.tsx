import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { statusConfig, type Status } from './status'
import { StatusMark } from './StatusMark'

/**
 * Correction in the margin, written like a teacher: status mark + short comment in Casual script.
 * `index` orders the draw-in animation top to bottom (`animate`, plays once, off for reduced motion).
 * `step` adds the step number in a circle (same mark as next to the underline in the drawing).
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
          {step !== undefined && (
            <span className="font-normal">
              <span
                aria-hidden="true"
                className="mr-1 inline-grid size-5 place-items-center rounded-full border-[1.5px] border-current align-middle text-xs leading-none font-semibold"
              >
                {step}
              </span>
              <span className="sr-only">Schritt {step}: </span>
            </span>
          )}
          {children}
        </p>
      )}
    </div>
  )
}
