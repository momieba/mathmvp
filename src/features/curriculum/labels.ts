import type { SchoolType, State } from './schema'

export const stateLabels: Record<State, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
}

export const schoolTypeLabels: Record<SchoolType, string> = {
  gymnasium: 'Gymnasium',
  realschule: 'Realschule',
  gesamtschule: 'Gesamtschule',
  hauptschule: 'Hauptschule',
  mittelschule: 'Mittelschule',
  oberschule: 'Oberschule',
  sekundarschule: 'Sekundarschule',
  stadtteilschule: 'Stadtteilschule',
}

export const grades = [5, 6, 7, 8, 9, 10, 11, 12, 13] as const

/** Entries sorted by German label, for select inputs. */
export const sortedEntries = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as [K, string][]).sort(([, a], [, b]) => a.localeCompare(b, 'de'))
