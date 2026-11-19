export const site = {
  name: 'Mathe-Training',
  url: 'https://mathmvp.vercel.app',
  description:
    'Mathe üben für Klasse 5 bis 13 – passend zu Bundesland, Schulform und Klasse. Mit Lösungsweg Schritt für Schritt. Kostenlos in der Beta.',
}

/** Hero copy: promise only what the app does today (no handwriting correction yet). */
export const hero = {
  title: 'Übe, was bei dir im Lehrplan steht.',
  text: 'Aufgaben für dein Bundesland, deine Schulform und deine Klasse – jede mit Lösungsweg und mit Hinweisen, wenn du feststeckst.',
  facts: 'Kostenlos in der Beta. Ohne Passwort. Werbefrei.',
}

export const intro = {
  title: 'Im Unterricht ging’s zu schnell?',
  text: 'Im Schulbuch steht oft nur das Ergebnis, und Nachhilfe ist nicht immer da, wenn du sie brauchst. Mit Mathe-Training übst du in deinem Tempo und siehst bei jeder Aufgabe, wie man auf die Lösung kommt.',
}

export const features = [
  {
    title: 'Passend zu deinem Lehrplan',
    text: 'Du wählst Bundesland, Schulform und Klasse und übst genau die Themen, die bei dir gerade drankommen.',
  },
  {
    title: 'Lösungsweg Schritt für Schritt',
    text: 'Zu jeder Aufgabe gibt es eine Musterlösung in einzelnen Schritten. Und Hinweise, wenn du feststeckst – ohne gleich alles zu verraten.',
  },
  {
    title: 'Schwer genug, nie zu schwer',
    text: 'Vier Schwierigkeitsstufen von leicht bis sehr schwer. Die nächste Aufgabe richtet sich nach deinem Punktestand. Aktuell gibt es Rechenaufgaben und Multiple Choice.',
  },
  {
    title: 'Erklärvideos zu jedem Thema',
    text: 'Kurze Videos erklären die Grundlagen, bevor du loslegst.',
    soon: true,
  },
  {
    title: 'Werbefrei und datensparsam',
    text: 'Keine Werbung, kein Tracking. Du brauchst kein Passwort.',
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
    a: 'Nein. In der Beta startest du ohne Anmeldung. Später meldest du dich mit deinem Google-Konto oder per E-Mail an – ein Passwort brauchst du nie.',
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
