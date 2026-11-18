import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { landingJsonLd, renderLanding } from '@/prerender/entry'
import { faq } from './content'
import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
  })

  it('has exactly one h1 with the value proposition', () => {
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/deinem Lehrplan/)
  })

  it('links every primary CTA to the login', () => {
    const ctas = screen.getAllByRole('link', { name: 'Kostenlos starten' })
    expect(ctas.length).toBeGreaterThan(0)
    ctas.forEach((a) => expect(a).toHaveAttribute('href', '/login'))
  })

  it('links the legal pages in the footer', () => {
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum')
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute(
      'href',
      '/datenschutz',
    )
  })
})

describe('prerender entry', () => {
  it('renders static HTML including the KaTeX preview', () => {
    const html = renderLanding()
    expect(html).toContain('<h1')
    expect(html).toContain('class="katex"')
  })

  it('emits valid FAQ JSON-LD that cannot break out of the script tag', () => {
    const json = landingJsonLd()
    expect(json).not.toContain('<')
    const data = JSON.parse(json) as { '@type': string; mainEntity?: unknown[] }[]
    expect(data.find((d) => d['@type'] === 'FAQPage')?.mainEntity).toHaveLength(faq.length)
  })
})
