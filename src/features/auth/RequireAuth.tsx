import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
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
      <p role="alert" className="text-destructive mx-auto max-w-md p-8 text-center">
        Die App konnte dich nicht automatisch anmelden ({anonError}). Bitte versuche es später noch
        einmal.
      </p>
    )
  if (loading || (!AUTH_ENABLED && !session))
    return <p className="text-muted-foreground p-8 text-center">Lädt …</p>
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
