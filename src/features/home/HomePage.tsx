import { Link } from 'react-router'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { Formula } from '@/components/math/Formula'
import { Button, buttonVariants } from '@/components/ui/button'
import { signOut } from '@/features/auth/api'
import { schoolTypeLabels, stateLabels } from '@/features/curriculum/labels'
import { useProfile } from '@/features/profile/api'

export function HomePage() {
  const { data: profile } = useProfile()
  return (
    <div className="flex min-h-svh flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            Hallo{profile?.display_name ? `, ${profile.display_name}` : ''}!
          </h1>
          <div className="flex gap-2">
            <Link to="/profil" className={buttonVariants({ variant: 'ghost' })}>
              Profil
            </Link>
            <Button variant="ghost" onClick={() => void signOut()}>
              Abmelden
            </Button>
          </div>
        </header>
        {profile?.state && profile.school_type && (
          <p className="text-muted-foreground">
            {schoolTypeLabels[profile.school_type]} · Klasse {profile.grade} ·{' '}
            {stateLabels[profile.state]}
          </p>
        )}
        <Formula block tex="x_{1,2} = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}" />
      </main>
      <SiteFooter />
    </div>
  )
}
