import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendEmailOtp, signInWithGoogle, verifyEmailOtp } from './api'
import { useAuth } from './AuthProvider'
import { AUTH_ENABLED } from './config'

type Step = 'email' | 'code'

export function LoginPage() {
  const { session } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Login disabled (AUTH_ENABLED = false): the app signs in anonymously, the login page is not needed.
  if (session || !AUTH_ENABLED) return <Navigate to="/app" replace />

  async function run(action: () => Promise<{ error: Error | null }>, onSuccess?: () => void) {
    setBusy(true)
    setError(null)
    const { error } = await action()
    setBusy(false)
    if (error) setError(error.message)
    else onSuccess?.()
  }

  function onSubmitEmail(e: FormEvent) {
    e.preventDefault()
    void run(
      () => sendEmailOtp(email),
      () => setStep('code'),
    )
  }

  function onSubmitCode(e: FormEvent) {
    e.preventDefault()
    void run(() => verifyEmailOtp(email, code))
  }

  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>Ohne Passwort – mit Google oder per E-Mail-Code.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button variant="outline" disabled={busy} onClick={() => void run(signInWithGoogle)}>
              Mit Google anmelden
            </Button>
            <div className="text-muted-foreground text-center text-xs">oder</div>
            {step === 'email' ? (
              <form onSubmit={onSubmitEmail} className="flex flex-col gap-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button type="submit" disabled={busy}>
                  Code senden
                </Button>
              </form>
            ) : (
              <form onSubmit={onSubmitCode} className="flex flex-col gap-2">
                <Label htmlFor="code">Code aus der E-Mail an {email}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                />
                <Button type="submit" disabled={busy}>
                  Anmelden
                </Button>
                <Button type="button" variant="link" onClick={() => setStep('email')}>
                  Andere E-Mail verwenden
                </Button>
              </form>
            )}
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  )
}
