import { createBrowserRouter } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LandingPage } from '@/features/landing/LandingPage'
import { DashboardPage } from '@/features/learning/DashboardPage'
import { PracticePage } from '@/features/learning/PracticePage'
import { DatenschutzPage } from '@/features/legal/DatenschutzPage'
import { ImpressumPage } from '@/features/legal/ImpressumPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { RequireProfile } from '@/features/profile/RequireProfile'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/impressum', element: <ImpressumPage /> },
  { path: '/datenschutz', element: <DatenschutzPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/profil', element: <ProfilePage /> },
      {
        element: <RequireProfile />,
        children: [
          { path: '/app', element: <DashboardPage /> },
          { path: '/app/ueben/:slug', element: <PracticePage /> },
        ],
      },
    ],
  },
])
