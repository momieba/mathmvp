import { createBrowserRouter } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { HomePage } from '@/features/home/HomePage'
import { LandingPage } from '@/features/landing/LandingPage'
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
        children: [{ path: '/app', element: <HomePage /> }],
      },
    ],
  },
])
