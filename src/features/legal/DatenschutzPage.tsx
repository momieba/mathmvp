import { LegalLayout, Section } from './LegalLayout'
import { PRIVACY_DATE_LABEL, provider } from './provider'

// Entwurf, keine Rechtsberatung – vor Veröffentlichung prüfen lassen (siehe provider.ts).
// Grundlage: Drittanbieter-Scan des Projekts (Vercel, Supabase, Google OAuth, localStorage).
// Bei neuen Diensten (Mailversand, Zahlungen, Analytics, Videos) den Skill `legal-pages` erneut
// ausführen und PRIVACY_VERSION erhöhen.

export function DatenschutzPage() {
  return (
    <LegalLayout title="Datenschutzerklärung">
      <Section title="Das Wichtigste in Kürze">
        <ul>
          <li>Wir speichern nur, was für dein Konto und dein Lernen nötig ist.</li>
          <li>Keine Werbung, kein Tracking, keine Analyse-Cookies.</li>
          <li>Deine Konto- und Lerndaten liegen auf Servern in der EU (Frankfurt am Main).</li>
          <li>Du kannst dein Konto jederzeit löschen lassen.</li>
        </ul>
      </Section>

      <Section title="1. Verantwortlicher">
        <p>
          {provider.name}, {provider.street}, {provider.city}
          <br />
          E-Mail: {provider.email}
        </p>
        <p>Ein Datenschutzbeauftragter ist nicht benannt, da keine gesetzliche Pflicht besteht.</p>
      </Section>

      <Section title="2. Hosting der Website (Vercel)">
        <p>
          Die Website wird bei Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA
          gehostet. Beim Aufruf verarbeitet Vercel technisch notwendige Daten wie IP-Adresse, Datum
          und Uhrzeit, aufgerufene Seite, Browser und Betriebssystem (Server-Logfiles), um die
          Website sicher und stabil auszuliefern.
        </p>
        <p>
          Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1
          lit. f DSGVO). Die Übermittlung in die USA erfolgt auf Grundlage des EU-US Data Privacy
          Framework bzw. der EU-Standardvertragsklauseln. Mit Vercel besteht ein Vertrag zur
          Auftragsverarbeitung. Speicherdauer der Logfiles: [PLATZHALTER: laut Vercel prüfen].
        </p>
      </Section>

      <Section title="3. Benutzerkonto und Lernprofil (Supabase)">
        <p>Wenn du ein Konto anlegst, speichern wir:</p>
        <ul>
          <li>deine E-Mail-Adresse (für die Anmeldung),</li>
          <li>einen freiwilligen Spitznamen (kein Klarname nötig),</li>
          <li>Bundesland, Schulform und Klasse (damit die Aufgaben zu deinem Lehrplan passen),</li>
          <li>wann du dieser Datenschutzerklärung zugestimmt hast,</li>
          <li>künftig deinen Lernfortschritt (bearbeitete Aufgaben und Ergebnisse).</li>
        </ul>
        <p>
          Rechtsgrundlage ist die Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO). Die
          Daten werden bei Supabase Inc. (USA) in einem Rechenzentrum in Frankfurt am Main
          gespeichert. Für etwaige Zugriffe aus Drittländern gelten die EU-Standardvertragsklauseln;
          mit Supabase besteht ein Vertrag zur Auftragsverarbeitung. Wir speichern die Daten, bis du
          dein Konto löschst.
        </p>
      </Section>

      <Section title="4. Anmeldung per E-Mail">
        <p>
          Für die Anmeldung ohne Passwort senden wir dir eine E-Mail mit einem Anmeldelink bzw.
          -code. Der Versand erfolgt über Supabase (siehe Abschnitt 3). Rechtsgrundlage: Art. 6 Abs.
          1 lit. b DSGVO.
        </p>
      </Section>

      <Section title="5. Anmeldung mit Google">
        <p>
          Wenn du „Mit Google anmelden“ wählst, wirst du zu Google weitergeleitet (Google Ireland
          Limited, Gordon House, Barrow Street, Dublin 4, Irland). Google übermittelt uns danach
          deinen Namen, deine E-Mail-Adresse und die Adresse deines Profilbilds. Wir verwenden davon
          nur die E-Mail-Adresse für dein Konto.
        </p>
        <p>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Google kann Daten auch in die USA
          übertragen; Google ist nach dem EU-US Data Privacy Framework zertifiziert. Mehr dazu in
          der{' '}
          <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">
            Datenschutzerklärung von Google
          </a>
          .
        </p>
      </Section>

      <Section title="6. Speicherung in deinem Browser">
        <p>
          Damit du angemeldet bleibst, speichern wir ein Anmelde-Token im lokalen Speicher deines
          Browsers (localStorage). Das ist für die Funktion der App unbedingt erforderlich (§ 25
          Abs. 2 Nr. 2 TDDDG) und wird beim Abmelden gelöscht. Wir setzen keine Cookies oder
          ähnlichen Technologien für Werbung, Analyse oder Tracking ein.
        </p>
      </Section>

      <Section title="7. Kinder und Jugendliche">
        <p>
          Mathe-Training richtet sich an Schülerinnen und Schüler. Wenn du jünger als 16 Jahre bist,
          brauchst du für die Nutzung das Einverständnis deiner Eltern. Eltern können sich jederzeit
          an uns wenden, um Auskunft zu erhalten oder das Konto ihres Kindes löschen zu lassen.
        </p>
      </Section>

      <Section title="8. Deine Rechte">
        <p>Du hast das Recht auf</p>
        <ul>
          <li>Auskunft über deine gespeicherten Daten (Art. 15 DSGVO),</li>
          <li>Berichtigung falscher Daten (Art. 16 DSGVO),</li>
          <li>Löschung deiner Daten (Art. 17 DSGVO),</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO),</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO),</li>
          <li>
            Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO),
          </li>
          <li>Widerruf einer Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).</li>
        </ul>
        <p>
          Schreib uns dafür einfach an {provider.email}. Außerdem kannst du dich bei einer
          Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), zum Beispiel bei der für uns
          zuständigen Behörde: {provider.supervisoryAuthority}.
        </p>
      </Section>

      <Section title="9. Konto löschen">
        <p>
          Du kannst die Löschung deines Kontos jederzeit per E-Mail an {provider.email} verlangen.
          Dabei werden dein Profil und alle Lerndaten vollständig gelöscht.
        </p>
      </Section>

      <Section title="10. Änderungen">
        <p>
          Wenn sich diese Datenschutzerklärung wesentlich ändert, bitten wir dich beim nächsten
          Anmelden erneut um deine Zustimmung.
        </p>
        <p>Stand: {PRIVACY_DATE_LABEL}</p>
      </Section>
    </LegalLayout>
  )
}
