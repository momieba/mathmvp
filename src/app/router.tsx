import { createBrowserRouter } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { HomePage } from '@/features/home/HomePage'
import { LandingPage } from '@/features/landing/LandingPage'
import { LegalPlaceholderPage } from '@/features/legal/LegalPlaceholderPage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/impressum', element: <LegalPlaceholderPage title="Impressum" /> },
  { path: '/datenschutz', element: <LegalPlaceholderPage title="Datenschutzerklärung" /> },
  {
    element: <RequireAuth />,
    children: [{ path: '/app', element: <HomePage /> }],
  },
])
