import { renderToString } from 'react-dom/server'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  it('renders the neutral "system" state on the server (no hydration mismatch)', () => {
    localStorage.setItem('theme', 'dark')
    expect(renderToString(<ThemeToggle />)).toContain('Darstellung: System')
    localStorage.clear()
  })
})
