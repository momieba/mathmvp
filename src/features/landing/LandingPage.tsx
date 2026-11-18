import { Clapperboard, Footprints, Layers, MapPinned, ShieldCheck, Check } from 'lucide-react'
import { Link } from 'react-router'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { buttonVariants } from '@/components/ui/button'
import { AUTH_ENABLED } from '@/features/auth/config'
import { cn } from '@/lib/utils'
import { faq, features, parentPoints, site, steps } from './content'
import { ExercisePreview } from './ExercisePreview'

// NOTE: This page is prerendered at build time (scripts/prerender.ts) and hydrated on the client.
// Keep it free of auth/Supabase access and of anything that differs between server and browser.

const icons = {
  map: MapPinned,
  steps: Footprints,
  levels: Layers,
  video: Clapperboard,
  shield: ShieldCheck,
} as const

/** Login is temporarily disabled (anonymous sign-in inside the app) → CTAs go straight to /app. */
const appEntry = AUTH_ENABLED ? '/login' : '/app'

const cta = cn(buttonVariants({ size: 'lg' }), 'h-11 px-5 text-base')
const ctaSecondary = cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'h-11 px-5 text-base')

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#inhalt"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Zum Inhalt springen
      </a>

      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Logo />
            {site.name}
          </Link>
          <nav aria-label="Hauptnavigation" className="flex items-center gap-1 sm:gap-2">
            <a
              href="#funktionen"
              className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}
            >
              Funktionen
            </a>
            <a
              href="#eltern"
              className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}
            >
              Für Eltern
            </a>
            <a
              href="#faq"
              className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}
            >
              FAQ
            </a>
            <Link to={appEntry} className={buttonVariants({ variant: 'outline' })}>
              {AUTH_ENABLED ? 'Anmelden' : 'Zur App'}
            </Link>
          </nav>
        </div>
      </header>

      <main id="inhalt" className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="from-primary/10 pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b to-transparent"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
            <div>
              <p className="text-primary mb-4 text-sm font-semibold tracking-wide uppercase">
                Mathe für Klasse 5 bis 13
              </p>
              <h1 className="text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl sm:leading-tight">
                Mathe üben, genau passend zu{' '}
                <span className="bg-highlight rounded px-1">deinem Lehrplan</span>.
              </h1>
              <p className="text-muted-foreground mt-6 max-w-xl text-lg text-pretty">
                Aufgaben, die zu deinem Bundesland, deiner Schulform und deiner Klasse passen. Und
                wenn du nicht weiterkommst: der Lösungsweg, Schritt für Schritt.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={appEntry} className={cta}>
                  Kostenlos starten
                </Link>
                <a href="#so-gehts" className={ctaSecondary}>
                  So funktioniert's
                </a>
              </div>
              <ul className="text-muted-foreground mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {['Kostenlos in der Beta', 'Ohne Passwort', 'Werbefrei'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check aria-hidden="true" className="text-primary size-4" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <ExercisePreview />
          </div>
        </section>

        {/* Problem → solution */}
        <section className="bg-secondary/50 border-y">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Im Unterricht ging's zu schnell?
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              Im Schulbuch steht oft nur das Ergebnis, und Nachhilfe ist nicht immer da, wenn du sie
              brauchst. Mit Mathe-Training übst du in deinem Tempo – und siehst bei jeder Aufgabe,
              wie man auf die Lösung kommt.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="funktionen" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Alles, was du zum Üben brauchst
            </h2>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => {
                const Icon = icons[f.icon]
                return (
                  <li key={f.title} className="bg-card rounded-xl border p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-lg">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      {'soon' in f && f.soon && (
                        <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-1 text-xs font-medium">
                          Bald verfügbar
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{f.text}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="so-gehts" className="bg-secondary/50 scroll-mt-16 border-y">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              So funktioniert's
            </h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="text-center">
                  <span
                    aria-hidden="true"
                    className="bg-primary text-primary-foreground mx-auto grid size-12 place-items-center rounded-full text-lg font-bold"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Parents */}
        <section id="eltern" className="scroll-mt-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="text-primary mb-2 text-sm font-semibold tracking-wide uppercase">
                Für Eltern
              </p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Üben, ohne Ablenkung und ohne Datensammeln
              </h2>
            </div>
            <ul className="grid gap-6 sm:grid-cols-3">
              {parentPoints.map((p) => (
                <li key={p.title}>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Check aria-hidden="true" className="text-primary size-4 shrink-0" />
                    {p.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-secondary/50 scroll-mt-16 border-y">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Häufige Fragen
            </h2>
            <div className="mt-10 space-y-3">
              {faq.map((item) => (
                <details key={item.q} className="bg-card group rounded-xl border p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="text-muted-foreground text-xl transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section>
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">
              Bereit für die nächste Mathearbeit?
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Konto anlegen dauert eine Minute – kostenlos und ohne Passwort.
            </p>
            <Link to={appEntry} className={cn(cta, 'mt-8')}>
              Kostenlos starten
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function Logo() {
  return (
    <span
      aria-hidden="true"
      className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-sm font-bold"
    >
      √
    </span>
  )
}
