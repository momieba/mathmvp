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
