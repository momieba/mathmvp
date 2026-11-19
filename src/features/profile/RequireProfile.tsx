import { Navigate, Outlet } from 'react-router'
import { StateScreen } from '@/components/layout/StateScreen'
import { useProfile } from './api'
import { needsProfileSetup } from './needsProfileSetup'

/** Guards app routes: redirects to /profil until onboarding and privacy consent are complete. */
export function RequireProfile() {
  const { data: profile, isPending, error } = useProfile()
  if (isPending) return <StateScreen kind="loading" title="Dein Profil wird geladen …" />
  if (error)
    return (
      <StateScreen kind="error" title="Dein Profil konnte nicht geladen werden.">
        Lade die Seite neu. Wenn das nicht hilft, versuch es später noch einmal.
      </StateScreen>
    )
  if (needsProfileSetup(profile)) return <Navigate to="/profil" replace />
  return <Outlet />
}
