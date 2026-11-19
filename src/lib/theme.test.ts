import { applyTheme, nextTheme, readStoredTheme, setTheme, THEME_KEY } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('cycles system → light → dark → system', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })

  it('ignores invalid stored values', () => {
    localStorage.setItem(THEME_KEY, 'neon')
    expect(readStoredTheme()).toBe('system')
  })

  it('stores an explicit choice, sets the dark class and removes the key for "system"', () => {
    setTheme('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    setTheme('light')
    expect(document.documentElement).not.toHaveClass('dark')
    setTheme('system')
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
  })

  it('survives blocked storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readStoredTheme()).toBe('system')
    expect(() => setTheme('dark')).not.toThrow()
    expect(document.documentElement).toHaveClass('dark')
    spy.mockRestore()
    set.mockRestore()
    applyTheme('light')
  })
})

describe('theme-color', () => {
  it('follows an explicit choice and restores the defaults for "system"', () => {
    document.head.innerHTML =
      '<meta name="theme-color" content="#fafbfd" media="(prefers-color-scheme: light)">' +
      '<meta name="theme-color" content="#1e2b28" media="(prefers-color-scheme: dark)">'
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
    setTheme('dark')
    expect(metas.map((m) => m.content)).toEqual(['#1e2b28', '#1e2b28'])
    setTheme('light')
    expect(metas.map((m) => m.content)).toEqual(['#fafbfd', '#fafbfd'])
    setTheme('system')
    expect(metas.map((m) => m.content)).toEqual(['#fafbfd', '#1e2b28'])
    document.head.innerHTML = ''
  })
})
