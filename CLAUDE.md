# Mathe-Training

Lern-Web-App für Mathe-Nachhilfe, Klasse 5–13, alle Bundesländer/Schulformen. Schüler üben Aufgaben mit Musterlösung; Inhalte (Themen, Aufgaben) liegen in Supabase und werden von Agenten generiert. Solo-Projekt, Deployment auf Vercel.

## Befehle

```bash
npm run dev                 # Dev-Server (braucht .env.local, Vorlage .env.example)
npm run build               # tsc -b + vite build
npm test                    # alle Tests (Vitest)
npx vitest run src/features/exercises/schema.test.ts   # einzelne Testdatei
npm run typecheck && npm run lint && npm run format:check   # vor jedem Commit
npm run drafts:validate [-- <datei|ordner>]   # Entwürfe gegen Zod-Schema prüfen
npm run exercises:generate -- <vorlage.json> [--seed N] [--force]   # Aufgaben aus Vorlage erzeugen
npm run db:new <name> | db:push | db:types    # Supabase, siehe Skill supabase-migration
```

## Architektur

- **SPA ohne eigenes Backend**: Vite + React 19 + React Router, Daten über `@supabase/supabase-js` + TanStack Query. Sicherheit ausschließlich über **RLS** – darum Skill `supabase-migration` bei jeder Schema-Änderung.
- `src/features/<feature>/` feature-basiert; `src/components/ui/` ist shadcn-generiert (per `npx shadcn@latest add …`, nicht von Hand umbauen, von oxlint ausgenommen).
- `src/features/exercises/schema.ts` und `src/features/curriculum/schema.ts` sind die **einzige Quelle** für das Aufgaben- und Themenformat – genutzt von App, Validierungs-Script, Import und Agenten. Format ändern = dort ändern.
- Datenmodell (Lernplan): Themen/Subthemen global. Subthemen bilden pro Thema einen Lernpfad (`sort_order` + Stufe `einstieg → grundlagen → vertiefung → anwendung`) mit Lernzielen, Voraussetzungen (`subtopic_prerequisites`, auch themenübergreifend), Aufgabenplan (`exercise_plan`, **mind. 20 Aufgaben**) und geplanten Videos (`videos`, Status `planned → produced → published`). Einordnung `(Bundesland, Schulform, Klasse)` **pro Subthema**; Schwierigkeit pro Aufgaben-Placement. Referenzbeispiel: `src/features/curriculum/example-draft.ts`.
- Gemeinsame Inhalts-Enums in `src/features/content/enums.ts`.
- Diagramme werden als Daten gespeichert (`diagramSchema`), nicht als Bilder.
- Auth: Google OAuth + E-Mail-OTP (6-stelliger Code, PKCE). Kein Passwort-Login.
- Routen: öffentlich `/`, `/impressum`, `/datenschutz`, `/login`; mit Login `/profil` (Onboarding + Profil bearbeiten); mit Login **und** fertigem Profil `/app/*` (`RequireAuth` → `RequireProfile`).
- Prerender: `npm run build` rendert die Seiten aus `src/prerender/entry.tsx` (`pages`) per `scripts/prerender.ts` nach `dist/*.html` (hydratisiert in `main.tsx`, `cleanUrls` in `vercel.json`); alle anderen Routen bekommen die leere Shell `dist/spa.html` (`noindex`; Rewrite-Ziel wegen `cleanUrls` **`/spa`**, nicht `/spa.html` – sonst 404). Landing-Texte/FAQ in `src/features/landing/content.ts` (speist auch das JSON-LD).
- DB-Schema (`supabase/migrations/`): `profiles` (1:1 zu `auth.users`, per Trigger angelegt; Nutzer dürfen per Spaltenrechten nur `display_name`, `state`, `school_type`, `grade`, `privacy_version` ändern – `role` nie), `topics` → `subtopics` → `subtopic_placements`, `exercises` → `exercise_placements`, `exercise_solutions`. **Antworten/Lösungen/Hinweise nur in `exercise_solutions`** (für Schüler nicht lesbar); `exercises.presentation` enthält nur, was die UI braucht. Prüfen/Aufdecken später über SECURITY-DEFINER-Funktionen. Admin-Check: `private.is_admin()` (Schema `private` ist nicht per API erreichbar).
- DB-Enums müssen mit den Zod-Enums übereinstimmen – `src/features/content/enums.test.ts` prüft das zur Compile-Zeit (nach `npm run db:types`). Neues Enum → dort ergänzen.
- Rechtstexte: `src/features/legal/` – Anbieterdaten zentral in `provider.ts` (noch `[PLATZHALTER]`). Bei wesentlicher Änderung der Datenschutzerklärung `PRIVACY_VERSION` erhöhen → alle Nutzer müssen auf `/profil` neu zustimmen. Neue Drittanbieter → globalen Skill `legal-pages` erneut ausführen.
- `video/` ist eine Python-Pipeline (Manim, ElevenLabs, ffmpeg, Conda-Env `mathtutor`), unabhängig vom Web-Stack. Kopie aus `math-tutor-videos`.
- `research/curriculum/` enthält recherchierte Lehrplandaten (u.a. NRW Gymnasium) als Ausgangsbasis.

## Inhalts-Pipeline

```
curriculum-researcher → drafts/curriculum/*.json   (Lernplan: Themen, Subthemen, Einordnung, Videos, Aufgabenplan)
exercise-author       → drafts/templates/*.json → exercises:generate → drafts/exercises/*.json
                        (bevorzugt Vorlage + Generator; Handarbeit für handwritten/Begründungen/komplexe Sachaufgaben)
create-math-video/-short → Videos aus dem Video-Plan (keyPoints)
math-checker          → Bericht (FREIGEGEBEN / NICHT FREIGEGEBEN)
Import-Script         → Supabase, status = 'review'   (noch nicht gebaut)
Admin-Ansicht         → review → published → archived (noch nicht gebaut)
```

- Aufgaben werden nie gelöscht, nur archiviert (Schülerantworten referenzieren sie).
- Eigene Aufgaben nach Vorbild von Schulbuchaufgaben – **nie übernehmen**, Regeln in `.claude/agents/exercise-author.md`.
- Generator (`src/features/exercises/template/`): deklarative JSON-Vorlagen (mathjs-Ausdrücke, kein ausführbarer Agent-Code; Parser-Funktionen gesperrt), deterministisch pro Seed, erzeugt das **normale Entwurfsformat** – Rest der Pipeline unverändert. Unterstützt aktuell `numeric` und `multiple_choice`. Muster: `template/examples/pythagoras-hypotenuse-berechnen.json`. Ziel aktuell: 20 Aufgaben pro Subthema, gespeichert in der DB (keine Live-Generierung).
- Beim Überschreiben einer Generator-Datei (`--force`) bleiben die Keys gleich; Keys anderer Dateien desselben Subthemas werden fortgezählt.

## Agenten & Abläufe

- **Nach jeder Aufgaben-Generierung oder Änderung in `drafts/exercises/` immer `math-checker`.** Importiert wird nur, was er FREIGEGEBEN hat.
- **Hinweise des `math-checker`, dass etwas zu schwer für die Stufe ist, werden immer umgesetzt** – auch wenn er sie nicht als Warnung führt (Wunsch des Users). „Leicht“ heißt auch leichte, im Kopf nachrechenbare Zahlen.
- Fehlt ein Subthema für neue Aufgaben → zuerst `curriculum-researcher`.
- Schema-Änderungen → Skill `supabase-migration`.
- Videos → Skills `create-math-video` (16:9) und `create-math-short` (9:16); Arbeitsverzeichnis `video/`.
- `marketing`, `responder`, `buchhalter` sind Entwürfe (offene Punkte in `docs/TODO.md`), nur auf ausdrückliche Anfrage nutzen.
- Code-Arbeit: globale devflow-Agenten (`planner` → `implementer` → `tester` → `reviewer`).

## Regeln

- Nur der **Publishable Key** (`sb_publishable_…`) gehört in `VITE_*`-Variablen; Secret-/`service_role`-Key nie ins Frontend oder in Commits (nur lokal für Import-Scripts).
- Nutzer sind überwiegend minderjährig: Datensparsamkeit, keine Tracking-Tools ohne Rückfrage; Nutzerdaten-Tabellen mit `on delete cascade` auf `auth.users` (DSGVO-Löschung).
- UI-Texte Deutsch, Du-Form, echte Umlaute. Code und Bezeichner Englisch.
- Mathe immer über die `Formula`-Komponente (`src/components/math/Formula.tsx`) rendern, nicht `katex` direkt.

## Fallstricke

- TypeScript 7: `baseUrl` existiert nicht mehr – Pfad-Alias `@/*` nur über `paths`.
- Kein Docker → kein lokales Supabase. Die Supabase CLI zielt standardmäßig auf **lokal** – für das Cloud-Projekt immer `--remote` (in `db:push`/`db:types` schon drin; auch bei `db query`, `db advisors`, `config push`). Agent-Läufe brauchen für Schreibzugriffe `--yes`, für reine Abfragen `--read-only`.
- Nach jeder Migration: `npm run db:types` und `npx supabase db advisors --remote` (Ziel: keine Warnungen außer „Leaked Password Protection“, irrelevant ohne Passwort-Login).
- `src/types/database.ts` ist generiert – nicht von Hand ändern.
- Auth-Einstellungen (Site-URL, Redirects, OTP) liegen in `supabase/config.toml` → `npx supabase config push`. Vorher Diff lesen: Werte, die lokal nur Defaults sind, überschreiben sonst Remote-Einstellungen.
- Free-Tier mit Standard-SMTP: nur ~2 Mails/h und **keine eigenen Mail-Templates** → Standard-Mail enthält nur den Link, keinen 6-stelligen Code. Code-Login erst mit eigenem SMTP (z.B. Resend) + Template `supabase/templates/magic_link.html` (in `config.toml` auskommentiert).
- `npm audit` meldet `picomatch` in vite/vitest (nur Dev-Toolchain); kein `audit fix --force`.
- Video-Skills: Pfade relativ zu `video/`; Umlaute in Dateinamen vermeiden (`safe_thema`).
- `LandingPage` und alles, was sie importiert, darf weder Supabase/Auth noch `window`/`import.meta.env` nutzen und muss auf Server und Client identisch rendern – sonst bricht der Prerender bzw. die Hydration.
- `vite preview` kennt den `spa.html`-Rewrite nicht (liefert für alle Routen die Landing aus) – Routing-Verhalten nur auf Vercel-Previews prüfen.
- Neue öffentliche Seiten in `public/sitemap.xml` eintragen; geschützte Routen in `public/robots.txt` ausschließen.
