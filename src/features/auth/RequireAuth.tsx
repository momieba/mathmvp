import { Navigate, Outlet } from 'react-router'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <p className="text-muted-foreground p-8 text-center">Lädt …</p>
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
