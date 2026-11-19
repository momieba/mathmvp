import { render, screen } from '@testing-library/react'
import { MarginNote } from './MarginNote'
import { statusConfig, type Status } from './status'
import { StatusMark } from './StatusMark'

const all = Object.keys(statusConfig) as Status[]

describe('statusConfig', () => {
  it('gives every status its own label, icon and color (not color alone)', () => {
    expect([...all].sort()).toEqual(['correct', 'unclear', 'unreadable', 'wrong'])
    expect(new Set(all.map((s) => statusConfig[s].label)).size).toBe(all.length)
    expect(new Set(all.map((s) => statusConfig[s].icon)).size).toBe(all.length)
    expect(new Set(all.map((s) => statusConfig[s].color)).size).toBe(all.length)
  })
})

describe('StatusMark', () => {
  it.each(all)('renders an aria-hidden icon next to the text for %s', (status) => {
    const { container } = render(<StatusMark status={status} />)
    expect(container.querySelector('span[aria-hidden="true"] svg')).not.toBeNull()
    expect(screen.getByText(statusConfig[status].label)).not.toHaveClass('sr-only')
  })

  it.each(all)('compact keeps %s readable for screen readers only', (status) => {
    render(<StatusMark status={status} compact />)
    expect(screen.getByText(statusConfig[status].label)).toHaveClass('sr-only')
  })
})

describe('MarginNote', () => {
  it('sets data-status and uses the compact mark when a comment is present', () => {
    const { container } = render(<MarginNote status="unclear">Rechenweg fehlt</MarginNote>)
    expect(container.firstElementChild).toHaveAttribute('data-status', 'unclear')
    expect(screen.getByText('Nicht eindeutig')).toHaveClass('sr-only')
    expect(screen.getByText('Rechenweg fehlt')).toBeVisible()
  })

  it('shows the visible status label when there is no comment', () => {
    render(<MarginNote status="correct" />)
    expect(screen.getByText('Stimmt')).not.toHaveClass('sr-only')
  })

  it('prefixes the step number only when given', () => {
    const { rerender } = render(<MarginNote status="wrong">x</MarginNote>)
    expect(screen.queryByText(/Schritt/)).toBeNull()
    rerender(
      <MarginNote status="wrong" step={2}>
        x
      </MarginNote>,
    )
    expect(screen.getByText(/Schritt 2:/)).toBeInTheDocument()
  })

  it('animates only on request and passes the order as --i', () => {
    const { container, rerender } = render(<MarginNote status="correct" index={3} />)
    const el = container.firstElementChild as HTMLElement
    expect(el).not.toHaveClass('margin-animate')
    expect(el.style.getPropertyValue('--i')).toBe('3')
    rerender(<MarginNote status="correct" index={3} animate />)
    expect(container.firstElementChild).toHaveClass('margin-animate')
  })
})
