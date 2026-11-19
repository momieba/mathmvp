import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { HandwritingResult, PracticeExercise } from './api'
import { PracticePage } from './PracticePage'

let exercise: PracticeExercise
let gradeState: { data?: HandwritingResult; isPending: boolean; error: Error | null }
const mutate = vi.fn()
const reset = vi.fn()

vi.mock('./api', () => ({
  useSubtopic: () => ({ isPending: false, data: { id: 's1', title: 'Hypotenuse berechnen' } }),
  usePracticeExercises: () => ({ isPending: false, data: [exercise] }),
  useProgress: () => ({ data: new Map() }),
  useSubmitAnswer: () => ({ mutate: vi.fn(), isPending: false, data: undefined, error: null }),
  useGradeHandwriting: () => ({ ...gradeState, mutate, reset }),
  fetchHint: vi.fn(),
}))

vi.mock('./HandwritingCanvas', () => ({
  HandwritingCanvas: ({
    onChange,
    disabled,
    readOnly,
    ref,
  }: {
    onChange?: (ink: boolean) => void
    disabled?: boolean
    readOnly?: boolean
    ref?: { current: unknown }
  }) => {
    if (ref) ref.current = { toImage: () => 'data:image/png;base64,AAAA', isEmpty: () => false }
    return (
      <div data-testid="canvas" data-disabled={!!disabled} data-readonly={!!readOnly}>
        <button type="button" onClick={() => onChange?.(true)}>
          schreiben
        </button>
      </div>
    )
  },
}))

const numeric: PracticeExercise = {
  id: 'e1',
  type: 'numeric',
  prompt: 'Berechne $c$.',
  diagram: null,
  presentation: { unit: 'cm' },
  difficulty: 'leicht',
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/app/ueben/hypotenuse']}>
        <Routes>
          <Route path="/app/ueben/:slug" element={<PracticePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const gradedResult: HandwritingResult = {
  status: 'graded',
  correct: false,
  steps: [
    {
      studentWork: '$c^2 = 3^2 + 4^2$',
      verdict: 'correct',
      comment: 'Der Ansatz stimmt.',
      referenceStep: 1,
    },
    {
      studentWork: '$c = 8$',
      verdict: 'incorrect',
      comment: 'Die Wurzel aus 25 ist 5.',
      referenceStep: 2,
    },
    {
      studentWork: '$c^2 = 25$',
      verdict: 'unclear',
      comment: 'Schwer zu lesen.',
      referenceStep: null,
    },
  ],
  final: { studentValue: '8', verdict: 'incorrect', comment: 'Dein Endergebnis stimmt nicht.' },
  summary: 'Fast geschafft.',
  answer: { value: 5, unit: 'cm' },
  solution: { steps: [{ text: 'Rechne $\\sqrt{25}$.' }], result: '$c = 5$' },
}

beforeEach(() => {
  exercise = numeric
  gradeState = { isPending: false, error: null }
  mutate.mockClear()
  reset.mockClear()
})

describe('PracticePage with handwriting', () => {
  it('shows the drawing surface instead of a result field for numeric tasks', () => {
    renderPage()
    expect(screen.getByTestId('canvas')).toBeInTheDocument()
    expect(screen.queryByLabelText('Deine Antwort')).not.toBeInTheDocument()
    expect(screen.getByText(/Eine KI korrigiert deine Lösung/)).toBeInTheDocument()
    expect(screen.getByText(/mit der Einheit cm/)).toBeInTheDocument()
  })

  it('keeps multiple choice as click selection', () => {
    exercise = {
      ...numeric,
      type: 'multiple_choice',
      presentation: { options: ['3', '5'], multi: false },
    }
    renderPage()
    expect(screen.queryByTestId('canvas')).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('submits the drawing once something is written', () => {
    renderPage()
    const submit = screen.getByRole('button', { name: 'Lösung abgeben' })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'schreiben' }))
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    expect(mutate).toHaveBeenCalledWith({ exerciseId: 'e1', image: 'data:image/png;base64,AAAA' })
  })

  it('shows progress while grading and locks the sheet', () => {
    gradeState = { isPending: true, error: null }
    renderPage()
    expect(screen.getByText('Deine Lösung wird gelesen …')).toBeInTheDocument()
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Wird korrigiert …' })).toBeDisabled()
  })

  it('shows one correction per step, the result and the model solution', () => {
    gradeState = { isPending: false, error: null, data: gradedResult }
    renderPage()
    expect(screen.getByText('Schritt 1:')).toBeInTheDocument()
    expect(screen.getByText('Schritt 2:')).toBeInTheDocument()
    expect(screen.getByText('Schritt 3:')).toBeInTheDocument()
    expect(screen.getByText('Die Wurzel aus 25 ist 5.')).toBeInTheDocument()
    expect(screen.getByText('Dein Endergebnis stimmt nicht.')).toBeInTheDocument()
    expect(screen.getByText(/Fast geschafft/)).toBeInTheDocument()
    // status is carried by text, not by color alone
    expect(screen.getAllByText('Stimmt').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nicht richtig').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nicht eindeutig').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Musterlösung' })).toBeInTheDocument()
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-readonly', 'true')
    expect(screen.getByRole('button', { name: 'Nächste Aufgabe' })).toBeEnabled()
  })

  it('shows the unreadable state, keeps the sheet editable and lets the student submit again', () => {
    gradeState = {
      isPending: false,
      error: null,
      data: { status: 'unreadable', reason: 'illegible' },
    }
    renderPage()
    expect(
      screen.getByText(/Nicht lesbar – schreib etwas größer und gib nochmal ab\./),
    ).toBeInTheDocument()
    expect(screen.getByText(/zählt nicht als Versuch/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Musterlösung' })).not.toBeInTheDocument()
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-readonly', 'false')
    expect(screen.getByRole('button', { name: 'Lösung abgeben' })).toBeInTheDocument()
  })

  it('resets the unreadable note when the student writes again', () => {
    gradeState = {
      isPending: false,
      error: null,
      data: { status: 'unreadable', reason: 'empty' },
    }
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'schreiben' }))
    expect(reset).toHaveBeenCalled()
  })

  it('shows grading errors with their instruction', () => {
    gradeState = {
      isPending: false,
      error: new Error(
        'Zu viele Korrekturen in kurzer Zeit. Warte eine Minute und gib dann noch einmal ab.',
      ),
    }
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('Warte eine Minute')
  })
})
