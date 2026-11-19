import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from './ThemeToggle'
import { setTheme } from '@/lib/theme'

describe('ThemeToggle (client)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    setTheme('system')
  })

  it('exposes current and next mode in its accessible name', () => {
    render(<ThemeToggle />)
    expect(
      screen.getByRole('button', { name: 'Darstellung: System. Wechseln zu Hell.' }),
    ).toBeInTheDocument()
  })

  it('cycles System, Hell, Dunkel, System and applies each', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('button', { name: /Darstellung: Hell\./ })).toBeInTheDocument()
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')

    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('button', { name: /Darstellung: Dunkel\./ })).toBeInTheDocument()
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')

    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('button', { name: /Darstellung: System\./ })).toBeInTheDocument()
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('is operable with the keyboard', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: /Darstellung: Hell\./ })).toBeInTheDocument()
  })
})
