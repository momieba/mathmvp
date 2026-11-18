import { PRIVACY_VERSION } from '@/features/legal/provider'
import { needsProfileSetup } from './needsProfileSetup'

describe('needsProfileSetup', () => {
  it('requires setup for new users', () => {
    expect(needsProfileSetup({ onboarding_completed_at: null, privacy_version: null })).toBe(true)
  })

  it('requires renewed consent after a privacy policy update', () => {
    expect(
      needsProfileSetup({
        onboarding_completed_at: '2026-01-01T00:00:00Z',
        privacy_version: '2000-01-01',
      }),
    ).toBe(true)
  })

  it('lets onboarded users with current consent through', () => {
    expect(
      needsProfileSetup({
        onboarding_completed_at: '2026-01-01T00:00:00Z',
        privacy_version: PRIVACY_VERSION,
      }),
    ).toBe(false)
  })
})
