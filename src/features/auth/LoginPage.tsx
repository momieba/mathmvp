import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { PageShell } from '@/components/layout/PageShell'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/button'
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
    <PageShell header={<PublicHeader />} width="narrow">
      <h1 className="text-title">Anmelden</h1>
      <p className="text-prose text-muted-foreground mt-2">
        Ohne Passwort – mit Google oder per E-Mail-Code.
      </p>
      <div className="mt-8 flex flex-col gap-5">
        <Button variant="outline" disabled={busy} onClick={() => void run(signInWithGoogle)}>
          Mit Google anmelden
        </Button>
        <p className="text-fine text-muted-foreground">oder per E-Mail</p>
        {step === 'email' ? (
          <form onSubmit={onSubmitEmail} className="flex flex-col gap-3">
            <Label htmlFor="email">E-Mail-Adresse</Label>
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
          <form onSubmit={onSubmitCode} className="flex flex-col gap-3">
            <Label htmlFor="code" className="leading-snug">
              Code aus der E-Mail an {email}
            </Label>
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
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </PageShell>
  )
}
