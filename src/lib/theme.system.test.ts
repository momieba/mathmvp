import type { Theme } from './theme'

type Mql = { matches: boolean; addEventListener: (t: string, cb: () => void) => void }

function mockMatchMedia(matches: boolean) {
  const listeners: (() => void)[] = []
  const mql: Mql = {
    matches,
    addEventListener: (_t, cb) => {
      listeners.push(cb)
    },
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  )
  return {
    fire(next: boolean) {
      mql.matches = next
      listeners.forEach((l) => l())
    },
    listeners,
  }
}

/** The module keeps the current theme in module state, so every test gets a fresh copy. */
async function loadTheme() {
  vi.resetModules()
  return import('./theme')
}

describe('theme (system preference, subscriptions)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('"system" follows prefers-color-scheme', async () => {
    const { applyTheme } = await loadTheme()
    mockMatchMedia(true)
    applyTheme('system')
    expect(document.documentElement).toHaveClass('dark')
    mockMatchMedia(false)
    applyTheme('system')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('explicit choices ignore the system preference', async () => {
    const { applyTheme } = await loadTheme()
    mockMatchMedia(true)
    applyTheme('light')
    expect(document.documentElement).not.toHaveClass('dark')
    mockMatchMedia(false)
    applyTheme('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('treats a throwing matchMedia as "light"', async () => {
    const { applyTheme } = await loadTheme()
    vi.stubGlobal('matchMedia', () => {
      throw new Error('unavailable')
    })
    expect(() => applyTheme('system')).not.toThrow()
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('isTheme accepts only the three known values', async () => {
    const { isTheme } = await loadTheme()
    for (const v of ['system', 'light', 'dark']) expect(isTheme(v)).toBe(true)
    for (const v of ['', 'Dark', null, undefined, 1, {}]) expect(isTheme(v)).toBe(false)
  })

  it('reads a stored value on first getTheme and falls back to "system"', async () => {
    localStorage.setItem('theme', 'dark')
    expect((await loadTheme()).getTheme()).toBe('dark')
    localStorage.clear()
    expect((await loadTheme()).getTheme()).toBe('system')
  })

  it('notifies subscribers on setTheme and stops after unsubscribe', async () => {
    const { setTheme, subscribeTheme, getTheme } = await loadTheme()
    const listener = vi.fn()
    const unsubscribe = subscribeTheme(listener)
    setTheme('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getTheme()).toBe('dark')
    unsubscribe()
    setTheme('light')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getTheme()).toBe('light')
  })

  it('keeps the in-memory choice when storage is blocked', async () => {
    const { setTheme, getTheme } = await loadTheme()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => setTheme('dark')).not.toThrow()
    expect(getTheme()).toBe('dark')
    expect(() => setTheme('system')).not.toThrow()
    expect(getTheme()).toBe('system')
  })

  it('initTheme applies the stored theme and syncs OS changes only while "system"', async () => {
    const mm = mockMatchMedia(false)
    const { initTheme, setTheme } = await loadTheme()
    initTheme()
    expect(document.documentElement).not.toHaveClass('dark')
    expect(mm.listeners).toHaveLength(1)

    mm.fire(true)
    expect(document.documentElement).toHaveClass('dark')

    setTheme('light')
    mm.fire(true)
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('initTheme does not throw without matchMedia', async () => {
    const { initTheme } = await loadTheme()
    vi.stubGlobal('matchMedia', undefined)
    expect(() => initTheme()).not.toThrow()
  })

  it('nextTheme visits every theme once per cycle', async () => {
    const { nextTheme, themes } = await loadTheme()
    const seen: Theme[] = []
    let t: Theme = 'system'
    for (let i = 0; i < themes.length; i++) {
      seen.push(t)
      t = nextTheme(t)
    }
    expect(new Set(seen).size).toBe(themes.length)
    expect(t).toBe('system')
  })
})
