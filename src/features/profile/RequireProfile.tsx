import { Navigate, Outlet } from 'react-router'
import { useProfile } from './api'
import { needsProfileSetup } from './needsProfileSetup'

/** Guards app routes: redirects to /profil until onboarding and privacy consent are complete. */
export function RequireProfile() {
  const { data: profile, isPending, error } = useProfile()
  if (isPending) return <p className="text-muted-foreground p-8 text-center">Lädt …</p>
  if (error)
    return (
      <p role="alert" className="text-destructive p-8 text-center">
        Dein Profil konnte nicht geladen werden. Bitte lade die Seite neu.
      </p>
    )
  if (needsProfileSetup(profile)) return <Navigate to="/profil" replace />
  return <Outlet />
}
