import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SiteFooter } from './SiteFooter'

const widths = {
  narrow: 'max-w-xl',
  reading: 'max-w-3xl',
  default: 'max-w-4xl',
  wide: 'max-w-6xl',
} as const

/**
 * Page frame: skip link, header slot, `<main id="inhalt">`, footer. Left-aligned content column.
 * `bare` skips the content column (the page brings its own sections, e.g. the landing page).
 */
export function PageShell({
  header,
  width = 'default',
  bare = false,
  footer = true,
  className,
  children,
}: {
  header?: ReactNode
  width?: keyof typeof widths
  bare?: boolean
  footer?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#inhalt"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-lg px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Zum Inhalt springen
      </a>
      {header}
      <main
        id="inhalt"
        className={cn(
          'flex-1',
          !bare && ['mx-auto w-full px-4 py-8 sm:px-6 sm:py-10', widths[width]],
          className,
        )}
      >
        {children}
      </main>
      {footer && <SiteFooter />}
    </div>
  )
}
