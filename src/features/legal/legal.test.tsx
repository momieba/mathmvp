import { pages, renderPage } from '@/prerender/entry'

describe('prerendered public pages', () => {
  it('include landing, Impressum and Datenschutz with unique files and titles', () => {
    expect(pages.map((p) => p.path)).toEqual(['/', '/impressum', '/datenschutz'])
    expect(new Set(pages.map((p) => p.file)).size).toBe(pages.length)
    expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length)
  })

  it('render the legal pages with footer links', () => {
    for (const page of pages.filter((p) => p.path !== '/')) {
      const html = renderPage(page)
      expect(html).toContain('<h1')
      expect(html).toContain('href="/impressum"')
      expect(html).toContain('href="/datenschutz"')
    }
  })

  it('names every detected third-party service in the privacy policy', () => {
    const html = renderPage(pages.find((p) => p.path === '/datenschutz')!)
    for (const service of ['Vercel', 'Supabase', 'Google', 'localStorage']) {
      expect(html).toContain(service)
    }
  })
})
