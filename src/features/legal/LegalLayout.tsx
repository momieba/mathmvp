import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { SiteFooter } from '@/components/layout/SiteFooter'

// Prerendered at build time (scripts/prerender.ts): no auth/Supabase, no browser-only APIs.

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <Link to="/" className="text-muted-foreground text-sm hover:underline">
          ← Zur Startseite
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
        <div className="legal-prose mt-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-muted-foreground [&_a]:text-primary [&_strong]:text-foreground mt-3 space-y-3 leading-relaxed [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </section>
  )
}
