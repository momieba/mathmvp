import { LegalLayout, Section } from './LegalLayout'
import { provider } from './provider'

// Entwurf, keine Rechtsberatung – vor Veröffentlichung prüfen lassen (siehe provider.ts).

export function ImpressumPage() {
  return (
    <LegalLayout title="Impressum">
      <Section title="Angaben gemäß § 5 DDG">
        <p>
          {provider.name}
          <br />
          {provider.legalForm}
          <br />
          {provider.street}
          <br />
          {provider.city}
        </p>
      </Section>

      <Section title="Kontakt">
        <p>
          E-Mail: {provider.email}
          <br />
          Telefon: {provider.phone}
        </p>
      </Section>

      {provider.vatId && (
        <Section title="Umsatzsteuer">
          <p>{provider.vatId}</p>
        </Section>
      )}

      <Section title="Verbraucherstreitbeilegung">
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Section>
    </LegalLayout>
  )
}
