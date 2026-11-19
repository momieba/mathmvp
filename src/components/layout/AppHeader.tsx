import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { buttonClass } from '@/lib/buttonClass'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

/**
 * Header of the signed-in app. On focus pages (`back` set) the back link replaces the logo so that
 * nothing but the task remains; `actions` holds page-level links (Profil, Abmelden).
 */
export function AppHeader({
  back,
  title,
  actions,
  width = 'default',
}: {
  back?: { to: string; label: string }
  title?: string
  actions?: ReactNode
  width?: 'reading' | 'default'
}) {
  return (
    <header className="border-b">
      <div
        className={cn(
          'mx-auto flex min-h-14 items-center justify-between gap-2 px-4 sm:px-6',
          width === 'reading' ? 'max-w-3xl' : 'max-w-4xl',
        )}
      >
        {back ? (
          <Link
            to={back.to}
            className="text-foreground -mx-2 inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 underline-offset-4 hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-5 shrink-0" />
            <span className="truncate">{back.label}</span>
          </Link>
        ) : (
          <Logo />
        )}
        <div className="flex shrink-0 items-center gap-1">
          {title && (
            <span className="text-muted-foreground text-fine hidden truncate sm:inline">
              {title}
            </span>
          )}
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

/** Standard "Profil" link for the app header. */
export function ProfileLink() {
  return (
    <Link to="/profil" className={buttonClass({ variant: 'ghost' })}>
      Profil
    </Link>
  )
}
