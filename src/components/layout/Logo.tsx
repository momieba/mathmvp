import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/** Wordmark: ein Wurzelzeichen in Königsblau, Name in Casual-Schrift. Link zur Startseite. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'casual -mx-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-bold',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg text-base leading-none"
      >
        √
      </span>
      Mathe-Training
    </Link>
  )
}
