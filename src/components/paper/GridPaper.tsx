import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Edge length of one Karo in px – keep in sync with `--karo-size` in index.css (drawing canvas, Etappe 6). */
export const KARO_SIZE = 20

/**
 * Karopapier: the work surface. Squared paper via CSS, optional correction margin on the right
 * (below the sheet on small screens). Use only where something is calculated or corrected –
 * never as page wallpaper.
 */
export function GridPaper({
  children,
  margin,
  raised = false,
  as: Tag = 'div',
  className,
  contentClassName,
  marginClassName,
  marginAt = 'md',
  ...rest
}: Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  children: ReactNode
  /** Content of the correction margin (MarginNotes). */
  margin?: ReactNode
  /** Active worksheet: lies on the table (the only shadow in the app). */
  raised?: boolean
  as?: 'div' | 'section' | 'figure' | 'article'
  contentClassName?: string
  marginClassName?: string
  /** From which breakpoint the margin sits beside the sheet (below it before). `lg`: tablets in portrait get the full width. */
  marginAt?: 'md' | 'lg'
}) {
  return (
    <Tag
      className={cn(
        'grid-paper rounded-paper border',
        raised && 'shadow-sheet',
        margin !== undefined &&
          (marginAt === 'lg'
            ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_17rem]'
            : 'md:grid md:grid-cols-[minmax(0,1fr)_14rem]'),
        className,
      )}
      {...rest}
    >
      <div className={cn('min-w-0 px-4 py-3', contentClassName)}>{children}</div>
      {margin !== undefined && (
        <div
          className={cn(
            'border-t-2 px-4 py-3',
            marginAt === 'lg' ? 'lg:border-t-0 lg:border-l-2' : 'md:border-t-0 md:border-l-2',
            marginClassName,
          )}
        >
          {margin}
        </div>
      )}
    </Tag>
  )
}
