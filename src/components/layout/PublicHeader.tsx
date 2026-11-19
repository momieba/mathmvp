import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

/** Header for public pages (landing, login, legal): logo left, actions + theme toggle right. */
export function PublicHeader({
  children,
  className,
  wide = false,
}: {
  children?: ReactNode
  className?: string
  wide?: boolean
}) {
  return (
    <header className={cn('border-b', className)}>
      <div
        className={cn(
          'mx-auto flex min-h-14 items-center justify-between gap-2 px-4 sm:px-6',
          wide ? 'max-w-6xl' : 'max-w-4xl',
        )}
      >
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          {children && (
            <nav aria-label="Hauptnavigation" className="flex items-center gap-1 sm:gap-2">
              {children}
            </nav>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
