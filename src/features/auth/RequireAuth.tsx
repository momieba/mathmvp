import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { StateScreen } from '@/components/layout/StateScreen'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'
import { AUTH_ENABLED } from './config'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const [anonError, setAnonError] = useState<string | null>(null)
  const requested = useRef(false)

  // Login disabled: sign in anonymously when entering the app (not on the landing page,
  // so crawlers and casual visitors do not create accounts).
  useEffect(() => {
    if (AUTH_ENABLED || loading || session || requested.current) return
    requested.current = true
    void supabase.auth.signInAnonymously().then(({ error }) => {
      if (error) setAnonError(error.message)
    })
  }, [loading, session])

  if (anonError)
    return (
      <StateScreen kind="error" title="Du konntest nicht angemeldet werden.">
        Die App hat dich nicht automatisch angemeldet ({anonError}). Lade die Seite später noch
        einmal neu.
      </StateScreen>
    )
  if (loading || (!AUTH_ENABLED && !session))
    return <StateScreen kind="loading" title="Einen Moment …" />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
