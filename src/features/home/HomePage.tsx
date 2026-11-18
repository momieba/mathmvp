import { Formula } from '@/components/math/Formula'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/api'
import { useAuth } from '@/features/auth/AuthProvider'

export function HomePage() {
  const { session } = useAuth()
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mathe-Training</h1>
        <Button variant="ghost" onClick={() => void signOut()}>
          Abmelden
        </Button>
      </header>
      <p className="text-muted-foreground">Angemeldet als {session?.user.email}</p>
      <Formula block tex="x_{1,2} = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}" />
    </main>
  )
}
