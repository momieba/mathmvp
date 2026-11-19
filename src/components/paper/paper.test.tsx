import { render, screen } from '@testing-library/react'
import { GridPaper } from './GridPaper'
import { MarginNote } from './MarginNote'
import type { Status } from './status'
import { StatusMark } from './StatusMark'

describe('StatusMark', () => {
  const cases: [Status, string][] = [
    ['correct', 'Stimmt'],
    ['wrong', 'Nicht richtig'],
    ['unclear', 'Nicht eindeutig'],
    ['unreadable', 'Nicht lesbar'],
  ]
  it.each(cases)('names %s in text, not only by color', (status, label) => {
    render(<StatusMark status={status} />)
    expect(screen.getByText(label)).toBeVisible()
  })

  it('keeps the label for screen readers when compact', () => {
    render(<StatusMark status="correct" compact />)
    expect(screen.getByText('Stimmt')).toHaveClass('sr-only')
  })
})

describe('MarginNote and GridPaper', () => {
  it('shows the comment next to the mark', () => {
    render(<MarginNote status="wrong">√16 ist 4, nicht 8</MarginNote>)
    expect(screen.getByText('√16 ist 4, nicht 8')).toBeInTheDocument()
    expect(screen.getByText('Nicht richtig')).toBeInTheDocument()
  })

  it('renders sheet and margin side by side', () => {
    render(
      <GridPaper margin={<MarginNote status="correct" />}>
        <p>h = 4</p>
      </GridPaper>,
    )
    expect(screen.getByText('h = 4')).toBeInTheDocument()
    expect(screen.getAllByText('Stimmt').length).toBeGreaterThan(0)
  })
})
