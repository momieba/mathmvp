/**
 * Theme preference: "system" (default), "light" (Papier) or "dark" (Tafel).
 * The class on <html> is set before first paint by the inline script in index.html;
 * this module only changes it afterwards (user action or system change).
 * All browser access is wrapped in try/catch (localStorage can be blocked) and happens
 * in client-only callbacks, so the prerendered landing page stays hydration-safe.
 */
export type Theme = 'system' | 'light' | 'dark'

export const THEME_KEY = 'theme'
export const themes: readonly Theme[] = ['system', 'light', 'dark']

const listeners = new Set<() => void>()

export function isTheme(value: unknown): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return isTheme(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
  currentTheme = theme
  applyTheme(theme)
  listeners.forEach((l) => l())
}

let currentTheme: Theme | null = null

export function getTheme(): Theme {
  return (currentTheme ??= readStoredTheme())
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function nextTheme(theme: Theme): Theme {
  return themes[(themes.indexOf(theme) + 1) % themes.length]!
}

/** Call once in the browser entry: keeps "system" in sync with the OS setting. */
export function initTheme(): void {
  applyTheme(getTheme())
  try {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => getTheme() === 'system' && applyTheme('system'))
  } catch {
    // matchMedia unavailable: nothing to sync.
  }
}
