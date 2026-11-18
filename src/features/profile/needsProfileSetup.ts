import { PRIVACY_VERSION } from '@/features/legal/provider'
import type { Profile } from './api'

/** True if the user still has to finish onboarding or accept a new privacy policy version. */
export function needsProfileSetup(
  profile: Pick<Profile, 'onboarding_completed_at' | 'privacy_version'>,
) {
  return !profile.onboarding_completed_at || profile.privacy_version !== PRIVACY_VERSION
}
