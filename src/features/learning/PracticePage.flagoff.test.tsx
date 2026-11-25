import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { PracticeExercise } from './api'
import { PracticePage } from './PracticePage'

const { inCalls } = vi.hoisted(() => ({ inCalls: [] as unknown[][] }))

vi.mock('./config', () => ({ HANDWRITING_ENABLED: false }))
vi.mock('@/lib/supabase', () => {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.in = (...args: unknown[]) => {
    inCalls.push(args)
    return Promise.resolve({ data: [], error: null })
  }
  return { supabase: { from: () => chain } }
})

const exercise: PracticeExercise = {
  id: 'e1',
  type: 'numeric',
  prompt: 'Berechne $c$.',
  diagram: null,
  presentation: { unit: 'cm' },
  difficulty: 'leicht',
}

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  useSubtopic: () => ({ isPending: false, data: { id: 's1', title: 'Hypotenuse berechnen' } }),
  usePracticeExercises: () => ({ isPending: false, data: [exercise] }),
  useProgress: () => ({ data: new Map() }),
  usePrerequisites: () => ({ data: new Map() }),
  usePublishedVideos: () => ({ data: new Map() }),
}))

describe('HANDWRITING_ENABLED = false', () => {
  it('keeps the input field for numeric tasks and shows no drawing surface', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/app/ueben/x']}>
          <Routes>
            <Route path="/app/ueben/:slug" element={<PracticePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByLabelText('Deine Antwort')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Schreibfläche/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prüfen' })).toBeInTheDocument()
  })

  it('does not load handwritten tasks', async () => {
    const { usePracticeExercises } = await vi.importActual<typeof import('./api')>('./api')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    )
    renderHook(() => usePracticeExercises('s1'), { wrapper })
    await waitFor(() => expect(inCalls.length).toBeGreaterThan(0))
    expect(inCalls[0]).toEqual(['type', ['numeric', 'multiple_choice']])
  })
})
