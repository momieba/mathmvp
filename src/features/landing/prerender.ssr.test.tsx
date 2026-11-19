import { pages, renderPage } from '@/prerender/entry'

/** The prerender runs in Node: no window, document or storage. The pages must render identically anyway. */
describe('prerender without browser globals', () => {
  afterEach(() => vi.unstubAllGlobals())

  function withoutBrowser() {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('localStorage', undefined)
    vi.stubGlobal('matchMedia', undefined)
    expect(typeof window).toBe('undefined')
  }

  it.each(pages.map((p) => [p.path, p] as const))('renders %s without window', (_path, page) => {
    withoutBrowser()
    expect(renderPage(page)).toContain('<h1')
  })

  it('renders the landing deterministically, with and without window', () => {
    const landing = pages.find((p) => p.path === '/')!
    const withWindow = renderPage(landing)
    withoutBrowser()
    const a = renderPage(landing)
    expect(renderPage(landing)).toBe(a)
    expect(a).toBe(withWindow)
  })

  it('renders the neutral theme toggle state on the server', () => {
    localStorage.setItem('theme', 'dark')
    const html = renderPage(pages.find((p) => p.path === '/')!)
    localStorage.clear()
    expect(html).toContain('Darstellung: System')
    expect(html).not.toContain('Darstellung: Dunkel')
  })
})
