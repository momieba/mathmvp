import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PageShell } from '@/components/layout/PageShell'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { AUTH_ENABLED } from '@/features/auth/config'
import { buttonClass } from '@/lib/buttonClass'
import { faq, features, hero, intro, parentPoints, steps } from './content'
import { ExercisePreview } from './ExercisePreview'

// NOTE: This page is prerendered at build time (scripts/prerender.ts) and hydrated on the client.
// Keep it free of auth/Supabase access and of anything that differs between server and browser.
// (ThemeToggle is hydration-safe: it renders the neutral state first, see its docs.)

/** Login is temporarily disabled (anonymous sign-in inside the app) → CTAs go straight to /app. */
const appEntry = AUTH_ENABLED ? '/login' : '/app'

const navLink = buttonClass({ variant: 'ghost' }, 'hidden sm:inline-flex')

export function LandingPage() {
  return (
    <PageShell
      bare
      header={
        <PublicHeader wide>
          <a href="#so-gehts" className={navLink}>
            So geht’s
          </a>
          <a href="#eltern" className={navLink}>
            Für Eltern
          </a>
          <Link to={appEntry} className={buttonClass({ variant: 'outline' })}>
            {AUTH_ENABLED ? 'Anmelden' : 'Zur App'}
          </Link>
        </PublicHeader>
      }
    >
      {/* Hero: an exercise on squared paper with its worked solution */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 md:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="flex flex-col items-start">
          <h1 className="text-display">{hero.title}</h1>
          <p className="text-prose measure mt-6">{hero.text}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={appEntry} className={buttonClass({ size: 'lg' }, 'px-6')}>
              Kostenlos starten
            </Link>
            <a href="#so-gehts" className={buttonClass({ variant: 'ghost', size: 'lg' })}>
              So funktioniert’s
            </a>
          </div>
          <p className="text-fine text-muted-foreground mt-5">{hero.facts}</p>
        </div>
        <ExercisePreview />
      </section>

      <Block title={intro.title}>
        <p className="text-prose measure">{intro.text}</p>
      </Block>

      <Block title="Was dich erwartet">
        <ul className="divide-y">
          {features.map((f) => (
            <li
              key={f.title}
              className="grid gap-1 py-4 first:pt-0 sm:grid-cols-[14rem_1fr] sm:gap-6"
            >
              <h3 className="text-h3">{f.title}</h3>
              <p className="measure">
                {f.text}
                {'soon' in f && f.soon && (
                  <span className="text-fine text-muted-foreground"> Das kommt bald.</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </Block>

      <Block id="so-gehts" title="So funktioniert’s">
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 md:block">
              <span
                aria-hidden="true"
                className="casual text-primary text-h2 w-8 shrink-0 md:mb-2 md:block"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-h3">{s.title}</h3>
                <p className="text-muted-foreground mt-1">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Block>

      <Block id="eltern" title="Für Eltern: Üben ohne Ablenkung und ohne Datensammeln">
        <ul className="grid gap-6 sm:grid-cols-3">
          {parentPoints.map((p) => (
            <li key={p.title}>
              <h3 className="text-h3">{p.title}</h3>
              <p className="text-muted-foreground mt-1">{p.text}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block id="faq" title="Häufige Fragen">
        <div className="measure divide-y border-y">
          {faq.map((item) => (
            <details key={item.q} className="group py-1">
              <summary className="flex min-h-11 list-none items-center justify-between gap-4 py-2 font-medium">
                {item.q}
                <span
                  aria-hidden="true"
                  className="text-muted-foreground text-xl transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="text-muted-foreground pb-3">{item.a}</p>
            </details>
          ))}
        </div>
      </Block>

      <section className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-12 sm:px-6 md:py-16">
          <h2 className="text-h2">Bereit für die nächste Mathearbeit?</h2>
          <p className="text-prose measure text-muted-foreground">
            Wähl Bundesland, Schulform und Klasse und leg los – kostenlos und ohne Passwort.
          </p>
          <Link to={appEntry} className={buttonClass({ size: 'lg' }, 'mt-2 px-6')}>
            Kostenlos starten
          </Link>
        </div>
      </section>
    </PageShell>
  )
}

/** Section with the title in the left column and the content on the right (like a table of contents). */
function Block({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-2 border-t">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:py-14 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <h2 className="text-h2 text-balance">{title}</h2>
        <div>{children}</div>
      </div>
    </section>
  )
}
