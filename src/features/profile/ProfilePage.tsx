import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AppHeader } from '@/components/layout/AppHeader'
import { PageShell } from '@/components/layout/PageShell'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { StateScreen } from '@/components/layout/StateScreen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  commonSchoolTypes,
  grades,
  otherSchoolTypes,
  schoolTypeLabels,
  sortedEntries,
  stateLabels,
} from '@/features/curriculum/labels'
import type { SchoolType, State } from '@/features/curriculum/schema'
import { PRIVACY_VERSION } from '@/features/legal/provider'
import { useProfile, useUpdateProfile, type Profile } from './api'
import { needsProfileSetup } from './needsProfileSetup'

const selectClass =
  'border-input bg-background text-foreground h-11 w-full rounded-lg border px-3 text-base'

export function ProfilePage() {
  const { data: profile, isPending, error } = useProfile()
  if (isPending) return <StateScreen kind="loading" title="Dein Profil wird geladen …" />
  if (error)
    return (
      <StateScreen kind="error" title="Dein Profil konnte nicht geladen werden.">
        Lade die Seite neu. Wenn das nicht hilft, versuch es später noch einmal.
      </StateScreen>
    )
  return <ProfileForm profile={profile} />
}

function ProfileForm({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const update = useUpdateProfile()
  const isOnboarding = !profile.onboarding_completed_at
  const needsConsent = profile.privacy_version !== PRIVACY_VERSION

  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [state, setState] = useState<State | ''>(profile.state ?? '')
  const [schoolType, setSchoolType] = useState<SchoolType | ''>(profile.school_type ?? '')
  const [grade, setGrade] = useState<string>(profile.grade?.toString() ?? '')
  const [consent, setConsent] = useState(false)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!state || !schoolType || !grade) return
    update.mutate(
      {
        display_name: displayName.trim() || null,
        state,
        school_type: schoolType,
        grade: Number(grade),
        ...(needsConsent && consent ? { privacy_version: PRIVACY_VERSION } : {}),
      },
      {
        onSuccess: (saved) => {
          if (!needsProfileSetup(saved)) void navigate('/app', { replace: true })
        },
      },
    )
  }

  const header = isOnboarding ? (
    <PublicHeader />
  ) : (
    <AppHeader back={{ to: '/app', label: 'Zurück zur App' }} width="reading" />
  )

  return (
    <PageShell header={header} width="narrow">
      <h1 className="text-title">
        {isOnboarding ? 'Willkommen bei Mathe-Training' : 'Dein Profil'}
      </h1>
      <p className="text-prose text-muted-foreground mt-2">
        {isOnboarding
          ? 'Sag uns kurz, wo du zur Schule gehst. Dann passen die Aufgaben zu deinem Lehrplan.'
          : 'Hier kannst du deine Angaben ändern.'}
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="display_name">Spitzname (optional)</Label>
          <Input
            id="display_name"
            maxLength={40}
            autoComplete="nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="text-muted-foreground text-fine">Bitte nicht deinen echten vollen Namen.</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="state">Bundesland</Label>
          <select
            id="state"
            required
            className={selectClass}
            value={state}
            onChange={(e) => setState(e.target.value as State)}
          >
            <option value="" disabled>
              Bitte wählen
            </option>
            {sortedEntries(stateLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="school_type">Schulform</Label>
            <select
              id="school_type"
              required
              className={selectClass}
              value={schoolType}
              onChange={(e) => setSchoolType(e.target.value as SchoolType)}
            >
              <option value="" disabled>
                Bitte wählen
              </option>
              {commonSchoolTypes.map((value) => (
                <option key={value} value={value}>
                  {schoolTypeLabels[value]}
                </option>
              ))}
              <optgroup label="Weitere Schulformen">
                {otherSchoolTypes.map((value) => (
                  <option key={value} value={value}>
                    {schoolTypeLabels[value]}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="grade">Klasse</Label>
            <select
              id="grade"
              required
              className={selectClass}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="" disabled>
                –
              </option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {needsConsent && (
          <label className="flex min-h-11 items-start gap-3 leading-relaxed">
            <input
              type="checkbox"
              required
              className="accent-primary mt-1 size-5 shrink-0"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Ich habe die{' '}
              <Link
                to="/datenschutz"
                target="_blank"
                className="text-primary underline underline-offset-4"
              >
                Datenschutzerklärung
              </Link>{' '}
              gelesen. Ich bin mindestens 16 Jahre alt oder meine Eltern sind einverstanden.
            </span>
          </label>
        )}

        {update.error && (
          <p role="alert" className="text-destructive">
            Speichern hat nicht geklappt: {update.error.message}. Versuch es noch einmal.
          </p>
        )}

        <Button type="submit" disabled={update.isPending} className="self-start px-6">
          {isOnboarding ? 'Los geht’s' : 'Speichern'}
        </Button>
      </form>
    </PageShell>
  )
}
