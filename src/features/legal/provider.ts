// Provider details for Impressum and Datenschutzerklärung.
// TODO: Fill in all [PLATZHALTER] values before public launch – never invent them.
// Legal texts are drafts (generated with the `legal-pages` skill), not legal advice:
// compare with a generator (e.g. eRecht24, IT-Recht Kanzlei) or have them reviewed by a lawyer.

export const provider = {
  name: '[PLATZHALTER: Vor- und Nachname bzw. Firmenname]',
  legalForm: '[PLATZHALTER: Rechtsform, z.B. Einzelunternehmen]',
  street: '[PLATZHALTER: Straße und Hausnummer]',
  city: '[PLATZHALTER: PLZ und Ort]',
  email: '[PLATZHALTER: E-Mail-Adresse]',
  phone: '[PLATZHALTER: Telefonnummer oder zweiter schneller Kontaktweg]',
  /** null = not applicable; otherwise e.g. "DE123456789". */
  vatId: '[PLATZHALTER: USt-IdNr. oder Hinweis „Kleinunternehmer gemäß § 19 UStG“]',
  /** Data protection authority of the provider's federal state. */
  supervisoryAuthority:
    '[PLATZHALTER: Datenschutz-Aufsichtsbehörde deines Bundeslandes, z.B. LDI NRW, mit Anschrift]',
} as const

/** Bump when the privacy policy changes materially → users must accept again (see RequireOnboarding). */
export const PRIVACY_VERSION = '2026-11-18'
export const PRIVACY_DATE_LABEL = '18. November 2026'
