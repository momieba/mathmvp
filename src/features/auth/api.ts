import { supabase } from '@/lib/supabase'

const redirectTo = () => `${window.location.origin}/app`

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTo() },
  })
}

/** Sends an email containing both a 6-digit code and a magic link (template-dependent). */
export function sendEmailOtp(email: string) {
  return supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })
}

export function verifyEmailOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' })
}

export function signOut() {
  return supabase.auth.signOut()
}
