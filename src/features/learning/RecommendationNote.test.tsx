import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { RecommendationNote } from './RecommendationNote'

const video = { title: 'Brüche erklärt', url: 'https://example.org/v' }
const renderNote = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('RecommendationNote', () => {
  it('links to the prerequisite and its video', () => {
    renderNote(
      <RecommendationNote
        recommendation={{
          kind: 'prerequisite',
          subtopic: { id: 'a', slug: 'brueche', title: 'Brüche' },
          video,
        }}
      />,
    )
    expect(screen.getByText(/Wiederhole zuerst „Brüche“/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '„Brüche“ üben' })).toHaveAttribute(
      'href',
      '/app/ueben/brueche',
    )
    expect(screen.getByRole('link', { name: /Video ansehen/ })).toHaveAttribute('href', video.url)
  })

  it('suggests the basics without a video and can be dismissed', async () => {
    const onDismiss = vi.fn()
    renderNote(
      <RecommendationNote recommendation={{ kind: 'review', video: null }} onDismiss={onDismiss} />,
    )
    expect(screen.getByText(/Musterlösung Schritt für Schritt/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ausblenden' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
