import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PRIVACY_VERSION } from '@/features/legal/provider'
import { ProfilePage } from './ProfilePage'
import type { Profile } from './api'

let profile: Partial<Profile>
vi.mock('./api', () => ({
  useProfile: () => ({ data: profile, isPending: false, error: null }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}))

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const done: Partial<Profile> = {
  onboarding_completed_at: '2026-01-01T00:00:00Z',
  state: 'NW',
  school_type: 'gymnasium',
  grade: 8,
}

describe('ProfilePage back link', () => {
  it('links back to the app once the profile is complete', () => {
    profile = { ...done, privacy_version: PRIVACY_VERSION }
    renderPage()
    expect(screen.getByRole('link', { name: 'Zurück zur App' })).toHaveAttribute('href', '/app')
  })

  it('offers no way back while a new privacy version needs consent', () => {
    profile = { ...done, privacy_version: 'old' }
    renderPage()
    expect(screen.queryByRole('link', { name: 'Zurück zur App' })).not.toBeInTheDocument()
  })

  it('offers no way back during onboarding', () => {
    profile = { onboarding_completed_at: null, privacy_version: null }
    renderPage()
    expect(screen.queryByRole('link', { name: 'Zurück zur App' })).not.toBeInTheDocument()
  })
})
