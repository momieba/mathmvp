import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { faq, site } from '@/features/landing/content'
import { LandingPage } from '@/features/landing/LandingPage'

/** Renders the landing page to static HTML (hydrated by main.tsx in the browser). */
export function renderLanding(): string {
  return renderToString(
    <MemoryRouter initialEntries={['/']}>
      <LandingPage />
    </MemoryRouter>,
  )
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
