import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { faq, site } from '@/features/landing/content'
import { LandingPage } from '@/features/landing/LandingPage'
import { DatenschutzPage } from '@/features/legal/DatenschutzPage'
import { ImpressumPage } from '@/features/legal/ImpressumPage'

export type PrerenderPage = {
  path: string
  /** Output file in dist/ (served via vercel.json cleanUrls). */
  file: string
  title: string
  description: string
  element: ReactElement
  jsonLd?: () => string
}

/** Public pages rendered to static HTML at build time (hydrated by main.tsx in the browser). */
export const pages: PrerenderPage[] = [
  {
    path: '/',
    file: 'index.html',
    title: 'Mathe-Training – Mathe üben passend zu deinem Lehrplan (Klasse 5–13)',
    description: site.description,
    element: <LandingPage />,
    jsonLd: landingJsonLd,
  },
  {
    path: '/impressum',
    file: 'impressum.html',
    title: 'Impressum – Mathe-Training',
    description: 'Impressum und Anbieterkennzeichnung von Mathe-Training.',
    element: <ImpressumPage />,
  },
  {
    path: '/datenschutz',
    file: 'datenschutz.html',
    title: 'Datenschutzerklärung – Mathe-Training',
    description: 'Wie Mathe-Training mit deinen Daten umgeht: datensparsam, werbefrei, in der EU.',
    element: <DatenschutzPage />,
  },
]

export function renderPage(page: Pick<PrerenderPage, 'path' | 'element'>): string {
  return renderToString(<MemoryRouter initialEntries={[page.path]}>{page.element}</MemoryRouter>)
}

/** Kept for tests and backwards compatibility. */
export function renderLanding(): string {
  return renderPage(pages[0]!)
}

/** JSON-LD structured data for the landing page. */
export function landingJsonLd(): string {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: site.name,
      url: site.url,
      description: site.description,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      inLanguage: 'de',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]
  // Escape "<" so the JSON can never close the surrounding <script> tag.
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
