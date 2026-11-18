import { Link } from 'react-router'
import { SiteFooter } from '@/components/layout/SiteFooter'

// TODO: Replace with real content via the global `legal-pages` skill before public launch.
export function LegalPlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
        <Link to="/" className="text-muted-foreground text-sm hover:underline">
          ← Zur Startseite
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-4">Diese Seite wird gerade erstellt.</p>
      </main>
      <SiteFooter />
    </div>
  )
}
