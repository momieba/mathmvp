import type { ReactNode } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { PublicHeader } from '@/components/layout/PublicHeader'

// Prerendered at build time (scripts/prerender.ts): no auth/Supabase, no browser-only APIs.

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageShell header={<PublicHeader />} width="reading">
      <h1 className="text-title">{title}</h1>
      <div className="mt-8">{children}</div>
    </PageShell>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-h2">{title}</h2>
      <div className="measure [&_a]:text-primary mt-3 space-y-3 leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </section>
  )
}
