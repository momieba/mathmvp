/**
 * Temporary switch (see docs/TODO.md → "Authentication fertigstellen").
 * false → no login screen: every visitor is signed in anonymously (Supabase anonymous sign-ins
 *         must be enabled in the project). Profiles, onboarding and RLS keep working unchanged.
 * true  → regular login with Google / email (LoginPage).
 */
export const AUTH_ENABLED = false
