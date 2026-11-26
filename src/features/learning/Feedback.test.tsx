import { render, screen } from '@testing-library/react'
import { HandwritingNotes, type Graded } from './Feedback'
import { marksOf } from './feedbackText'

const base: Graded = {
  status: 'graded',
  correct: false,
  steps: [
    { studentWork: '$m = 2$', verdict: 'correct', comment: 'Steigung richtig', referenceStep: 1 },
    { studentWork: '$b = -3$', verdict: 'correct', comment: '', referenceStep: 3 },
  ],
  final: { studentValue: null, verdict: 'missing', comment: 'Die Funktionsgleichung fehlt noch.' },
  summary: '',
  answer: {},
  solution: { steps: [], result: '$f(x) = 2x - 3$' },
}

describe('HandwritingNotes', () => {
  it('shows correct steps with a check, the missing result neutral, and "almost" wording', () => {
    const { container } = render(<HandwritingNotes result={base} />)
    expect(container.querySelectorAll('[data-status="correct"]')).toHaveLength(2)
    expect(screen.getByText('Steigung richtig')).toBeInTheDocument()
    expect(screen.getByText('Stimmt.')).toBeInTheDocument() // fallback without comment
    expect(container.querySelectorAll('[data-status="missing"]')).toHaveLength(2)
    expect(container.querySelector('[data-status="wrong"]')).toBeNull()
    expect(screen.getByText(/Fast geschafft/)).toBeInTheDocument()
    expect(screen.queryByText(/Nicht ganz/)).toBeNull()
  })

  it('marks wrong steps with a cross and keeps "Nicht ganz." next to correct ones', () => {
    const result: Graded = {
      ...base,
      steps: [
        base.steps[0]!,
        { studentWork: '$b = 3$', verdict: 'incorrect', comment: 'Vorzeichen', referenceStep: 3 },
      ],
      final: { studentValue: '3', verdict: 'incorrect', comment: '' },
    }
    const { container } = render(<HandwritingNotes result={result} />)
    expect(container.querySelectorAll('[data-status="correct"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-status="wrong"]')).toHaveLength(2)
    expect(screen.getByText(/Nicht ganz/)).toBeInTheDocument()
    expect(screen.queryByText(/Fast geschafft/)).toBeNull()
  })
})

describe('marksOf', () => {
  it('marks correct steps with checks and wrong ones with underlines, only with a box', () => {
    const box: [number, number, number, number] = [1, 2, 3, 4]
    expect(
      marksOf([
        { studentWork: 'a', verdict: 'correct', comment: '', referenceStep: 1, box },
        { studentWork: 'b', verdict: 'incorrect', comment: '', referenceStep: 2, box },
        { studentWork: 'c', verdict: 'correct', comment: '', referenceStep: 3, box: null },
        { studentWork: 'd', verdict: 'unclear', comment: '', referenceStep: 4, box },
      ]),
    ).toEqual([
      { box, label: 1, kind: 'correct' },
      { box, label: 2, kind: 'wrong' },
    ])
  })
})
