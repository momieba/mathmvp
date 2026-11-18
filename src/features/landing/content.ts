export const site = {
  name: 'Mathe-Training',
  url: 'https://mathmvp.vercel.app',
  description:
    'Mathe üben für Klasse 5 bis 13 – passend zu Bundesland, Schulform und Klasse. Mit Lösungsweg Schritt für Schritt. Kostenlos in der Beta.',
}

export const features = [
  {
    icon: 'map',
    title: 'Passend zu deinem Lehrplan',
    text: 'Du wählst Bundesland, Schulform und Klasse – und übst genau die Themen, die bei dir gerade drankommen.',
  },
  {
    icon: 'steps',
    title: 'Lösungsweg Schritt für Schritt',
    text: 'Zu jeder Aufgabe gibt es eine Musterlösung in einzelnen Schritten. Und Hinweise, wenn du feststeckst – ohne gleich alles zu verraten.',
  },
  {
    icon: 'levels',
    title: 'Vom Einstieg bis zur Klausur',
    text: 'Vier Schwierigkeitsstufen und abwechslungsreiche Aufgabentypen: Rechnen, Multiple Choice, Zuordnen, Lückentext und mehr.',
  },
  {
    icon: 'video',
    title: 'Erklärvideos zu jedem Thema',
    text: 'Kurze Videos erklären die Grundlagen, bevor du loslegst.',
    soon: true,
  },
  {
    icon: 'shield',
    title: 'Werbefrei und datensparsam',
    text: 'Keine Werbung, kein Tracking. Anmelden geht ohne Passwort – per E-Mail oder Google.',
  },
] as const

export const steps = [
  { title: 'Klasse wählen', text: 'Bundesland, Schulform und Klasse einstellen.' },
  { title: 'Thema üben', text: 'Aufgaben lösen – erst leicht, dann kniffliger.' },
  { title: 'Lösungsweg verstehen', text: 'Schritt für Schritt nachvollziehen, wo es hakt.' },
] as const

export const parentPoints = [
  {
    title: 'Am Lehrplan orientiert',
    text: 'Themen und Klassenstufen richten sich nach den offiziellen Lehrplänen der Länder.',
  },
  {
    title: 'Keine Werbung, kein Tracking',
    text: 'Wir finanzieren uns nicht über Daten. Es gibt keine Werbe- oder Analyse-Cookies.',
  },
  {
    title: 'Daten in der EU',
    text: 'Konten und Lernstände werden in einem Rechenzentrum in Frankfurt gespeichert.',
  },
] as const

export const faq = [
  {
    q: 'Kostet Mathe-Training etwas?',
    a: 'Während der Beta ist Mathe-Training kostenlos. Falls später kostenpflichtige Funktionen dazukommen, erfährst du das vorher – ein Abo entsteht nie ohne deine ausdrückliche Bestellung.',
  },
  {
    q: 'Für welche Klassen und Bundesländer gibt es Aufgaben?',
    a: 'Mathe-Training ist für die Klassen 5 bis 13 gedacht. Die Inhalte werden schrittweise ausgebaut – los geht es mit dem Gymnasium in Nordrhein-Westfalen, weitere Bundesländer und Schulformen folgen.',
  },
  {
    q: 'Brauche ich ein Passwort?',
    a: 'Nein. Du meldest dich mit deinem Google-Konto oder per E-Mail an – du bekommst dann einen Anmeldelink.',
  },
  {
    q: 'Was passiert mit meinen Daten?',
    a: 'Wir speichern nur, was für dein Konto und deinen Lernfortschritt nötig ist, auf Servern in der EU. Du kannst dein Konto jederzeit löschen lassen.',
  },
  {
    q: 'Funktioniert das auch auf dem Handy?',
    a: 'Ja. Mathe-Training läuft im Browser auf Handy, Tablet und Computer – ohne App-Installation.',
  },
] as const
