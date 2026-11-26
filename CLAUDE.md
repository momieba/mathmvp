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
npm run content:import -- --curriculum | --skills | <aufgaben.json …> [--publish] [--dry-run]   # Entwürfe → Supabase (Service-Role-Key in .env.local)
npm run db:new <name> | db:push | db:types    # Supabase, siehe Skill supabase-migration
```

## Architektur

- **SPA ohne eigenes Backend**: Vite + React 19 + React Router, Daten über `@supabase/supabase-js` + TanStack Query. Sicherheit ausschließlich über **RLS** – darum Skill `supabase-migration` bei jeder Schema-Änderung.
- `src/features/<feature>/` feature-basiert; `src/components/ui/` ist shadcn-generiert (per `npx shadcn@latest add …`, nicht von Hand umbauen, von oxlint ausgenommen).
- `src/features/exercises/schema.ts` und `src/features/curriculum/schema.ts` sind die **einzige Quelle** für das Aufgaben- und Themenformat – genutzt von App, Validierungs-Script, Import und Agenten. Format ändern = dort ändern.
- Datenmodell (Lernplan): Themen/Subthemen global. Subthemen bilden pro Thema einen Lernpfad (`sort_order` + Stufe `einstieg → grundlagen → vertiefung → anwendung`) mit Lernzielen, Voraussetzungen (`subtopic_prerequisites`, auch themenübergreifend), Aufgabenplan (`exercise_plan`, **mind. 20 Aufgaben**) und geplanten Videos (`videos`, Status `planned → produced → published`). Einordnung `(Bundesland, Schulform, Klasse)` **pro Subthema**; Schwierigkeit pro Aufgaben-Placement. Referenzbeispiel: `src/features/curriculum/example-draft.ts`.
- Gemeinsame Inhalts-Enums in `src/features/content/enums.ts`.
- **Skill-Modell** (Plan: `docs/specs/2026-11-25-skill-modell-und-wiederholung.md`, lokal): Basis-Skills (übergreifende Fertigkeiten wie Bruchrechnung) in `src/features/skills/schema.ts` → `drafts/skills/catalog.json` → Tabellen `skills` + `skill_home_subtopics` (Heimat-Subthema = Ziel der Wiederholungs-Empfehlung). Skill-Slugs nie umbenennen/löschen (verfeinern über `parent`). Schüler sehen Skills vorerst **nicht** (erst nach Validierung). Wiederholungs-Empfehlungen auf Subthema-Basis: `learning/recommendations.ts` (Regeln dort).
- Diagramme werden als Daten gespeichert (`diagramSchema`), nicht als Bilder.
- Auth: Google OAuth + E-Mail-OTP (6-stelliger Code, PKCE). Kein Passwort-Login. **Aktuell deaktiviert** (`AUTH_ENABLED = false` in `src/features/auth/config.ts`): Beim Betreten von `/app`/`/profil` meldet `RequireAuth` anonym an (Supabase „anonymous sign-ins“ muss aktiv sein), Landing und Rechtsseiten lösen keine Anmeldung aus. Anonyme Nutzer haben die Rolle `authenticated` → RLS gilt unverändert. Rückbau: siehe `docs/TODO.md`.
- Routen: öffentlich `/`, `/impressum`, `/datenschutz`, `/login`; mit Login `/profil` (Onboarding + Profil bearbeiten); mit Login **und** fertigem Profil `/app` (Dashboard: Themensuche, „Meine Themen“ als Kacheln), `/app/thema/:slug` (Themenseite: Abschnitte, Prüfung, Entfernen), `/app/thema/:slug/pruefung[/:sessionId]` (Prüfung bzw. Ergebnis) und `/app/ueben/:subtopicSlug` (Übungsseite) (`RequireAuth` → `RequireProfile`).
- Lernen (`src/features/learning/`): Punkte pro Subthema werden **in der App** aus den letzten 15 Versuchen berechnet (`score.ts`, Regeln dort dokumentiert; View `my_recent_attempts`). Antworten prüft nur der Server (`submit_answer` – trägt den Versuch ein und gibt erst dann die Lösung zurück), Hinweise über `get_hint`. Aufgabenauswahl in `selectExercise.ts` (Schwierigkeit nach Punktestand, zuletzt gesehene vermeiden). Suche: `search_topics` (unaccent + `pg_trgm`, tolerant gegenüber Tippfehlern). Übungsseite: `multiple_choice` per Klick; `numeric` (und `handwritten`) nur per **Handschrift** (Feature-Flag `HANDWRITING_ENABLED` in `learning/config.ts`, **bewusst an während der MVP-Entwicklung**; vor öffentlichem Launch: Anbieterwechsel, Datenschutz, Etappe 8): Zeichenfläche `HandwritingCanvas` (Undo/Redo-Logik in `drawingHistory.ts`) → Edge Function `grade-handwriting` bewertet **jeden Schritt** (Antwortschema `steps[]`/`final`/`readable`, Logik in `supabase/functions/_shared/grading.ts`, Provider-Adapter in `_shared/provider.ts`, Adapter per Secret `GRADING_PROVIDER`). Bei `numeric` prüft der Server den abgelesenen Endwert selbst; **richtig = Endergebnis richtig und kein inhaltlich falscher Schritt** (`unclear` zählt nicht als falsch; `incorrect` nur für Ansatz-/Rechenfehler – formal unsaubere Notation/Nebenrechnungen wie „−9 = −7“ statt „2 − 9 = −7“ oder `f(3)` statt `g(3)` sind kein Fehler, sondern lösen den gelben Darstellungs-Tipp aus; Erfolgsmeldung „Richtig gelöst!“). Unlesbar → kein Versuch. Zusätzlich beurteilt das Modell die Darstellung (`presentation: { tidy, comment }`, nur Hinweis, nie Einfluss auf richtig/Punkte): bei `tidy = false` gelber „Tipp zur Darstellung“ im Korrekturrand (`PresentationTip` in `Feedback.tsx`, auch in der Prüfungsauswertung). Pro falschem Schritt liefert das Modell eine `box` ([ymin, xmin, ymax, xmax], 0–1000, relativ zum **zugeschnittenen** Export-Bild); die App unterstreicht die Stelle rot (Canvas: `boxToCanvas` mit dem letzten `ExportPlan`; Foto: SVG-Overlay). Rückmeldung kompakt (`Feedback.tsx`): nur falsche/unklare Schritte + „Richtig ist …“. Alternativ **Foto** (Tabs „Zeichnen | Foto“ in der Übungsseite, `PhotoInput.tsx`): `image.ts` dekodiert mit EXIF-Rotation, skaliert auf max. 1600 px und kodiert als JPEG neu (entfernt EXIF) bis Base64 ≤ 1,2 MB; gleiche Function mit `kind: 'photo'` (Prompt-Zusatz für Fotos, Tipps bei `photo_quality`). Bild wird nie gespeichert. Rate-Limit über Tabelle `grading_requests` (6/min, 80/Tag je Nutzer, 3.000/Tag global; Secrets `GRADING_LIMIT_PER_MINUTE`/`_PER_DAY`/`_GLOBAL_PER_DAY`, 0 = aus). `submit_answer` nimmt `numeric` noch an (serverseitige Sperre + Hinweis-Abzug folgen laut Plan in Etappe 4/8).
- Prüfungsmodus (`src/features/learning/exam/`, Migration `exam_mode`): `start_exam` (bis 8 Aufgaben über alle Subthemen, ohne `sehr_schwer`, 30 min, setzt offene Sitzung fort, wertet abgelaufene aus), `submit_exam_answer` (MC/Zahl, änderbar bis Abgabe), Handschrift über `grade-handwriting` mit `examSessionId` (speichert in `exam_answers`, gibt nur `saved`/`unreadable` zurück; 0,5 Punkte bei richtigem Ergebnis mit falschem Schritt), `finish_exam` (idempotent, liefert Lösungen). Deadline prüft der Server (+1 min Kulanz, `private.exam_grace()` = `EXAM_GRACE_MS`). `exam_answers` erst nach Abgabe lesbar. Prüfungen zählen **nicht** in die Übungspunkte. Note im Client (`examGrade.ts`: 92/81/67/50/30 %, ab Klasse 11 zusätzlich 0–15 Punkte). Antwortprüfung zentral in `private.check_answer` (auch von `submit_answer` genutzt).
- Prerender: `npm run build` rendert die Seiten aus `src/prerender/entry.tsx` (`pages`) per `scripts/prerender.ts` nach `dist/*.html` (hydratisiert in `main.tsx`, `cleanUrls` in `vercel.json`); alle anderen Routen bekommen die leere Shell `dist/spa.html` (`noindex`; Rewrite-Ziel wegen `cleanUrls` **`/spa`**, nicht `/spa.html` – sonst 404). Landing-Texte/FAQ in `src/features/landing/content.ts` (speist auch das JSON-LD).
- DB-Schema (`supabase/migrations/`): `profiles` (1:1 zu `auth.users`, per Trigger angelegt; Nutzer dürfen per Spaltenrechten nur `display_name`, `state`, `school_type`, `grade`, `privacy_version` ändern – `role` nie), `topics` → `subtopics` → `subtopic_placements`, `exercises` → `exercise_placements`, `exercise_solutions`. **Antworten/Lösungen/Hinweise nur in `exercise_solutions`** (für Schüler nicht lesbar); `exercises.presentation` enthält nur, was die UI braucht. Prüfen/Aufdecken später über SECURITY-DEFINER-Funktionen. Admin-Check: `private.is_admin()` (Schema `private` ist nicht per API erreichbar).
- DB-Enums müssen mit den Zod-Enums übereinstimmen – `src/features/content/enums.test.ts` prüft das zur Compile-Zeit (nach `npm run db:types`). Neues Enum → dort ergänzen.
- Rechtstexte: `src/features/legal/` – Anbieterdaten zentral in `provider.ts` (noch `[PLATZHALTER]`). Bei wesentlicher Änderung der Datenschutzerklärung `PRIVACY_VERSION` erhöhen → alle Nutzer müssen auf `/profil` neu zustimmen. Neue Drittanbieter → globalen Skill `legal-pages` erneut ausführen.
- `video/` ist eine Python-Pipeline (Manim, ElevenLabs, ffmpeg, Conda-Env `mathtutor`), unabhängig vom Web-Stack. Kopie aus `math-tutor-videos`.
- `research/curriculum/` enthält recherchierte Lehrplandaten (u.a. NRW Gymnasium) als Ausgangsbasis.

## Inhalts-Pipeline

```
curriculum-researcher → drafts/curriculum/*.json   (Lernplan: Themen, Subthemen, Einordnung, Videos, Aufgabenplan)
                      → drafts/skills/catalog.json  (Basis-Skills)
exercise-author       → drafts/templates/*.json → exercises:generate → drafts/exercises/*.json
                        (bevorzugt Vorlage + Generator; Handarbeit für handwritten/Begründungen/komplexe Sachaufgaben)
create-math-video/-short → Videos aus dem Video-Plan (keyPoints)
math-checker          → Bericht (FREIGEGEBEN / NICHT FREIGEGEBEN)
content:import        → Supabase (erst --curriculum, dann --skills, dann Aufgaben; --publish nur nach FREIGEGEBEN)
Admin-Ansicht         → review → published → archived (noch nicht gebaut – bis dahin direkt --publish)
```

- Aufgaben werden nie gelöscht, nur archiviert (Schülerantworten referenzieren sie).
- Eigene Aufgaben nach Vorbild von Schulbuchaufgaben – **nie übernehmen**, Regeln in `.claude/agents/exercise-author.md`.
- Generator (`src/features/exercises/template/`): deklarative JSON-Vorlagen (mathjs-Ausdrücke, kein ausführbarer Agent-Code; Parser-Funktionen gesperrt), deterministisch pro Seed, erzeugt das **normale Entwurfsformat** – Rest der Pipeline unverändert. Unterstützt `numeric` (Brüche + Toleranz), `multiple_choice` und `handwritten` (`rubric` mit Platzhaltern, erwartetes Ergebnis in `solution.result`); LaTeX-Helfer `frac()`, `tex()`, `signed()` in Platzhaltern sowie für einheitliche Musterlösungen (Spec `docs/specs/2026-11-26-loesungsschema.md`, nie „1 ·“): `coef(a)` (1 → „“, −1 → „-“), `times(a, x)`, `signedTerm(b, 'y')` (`+ 3y`/`- y`), `signedTimes(b, y)`, `paren(x)` (Klammern nur bei negativ). Lösungsschritte, die entfallen können: `{ "text": "…", "when": "k != 1" }` statt String (`when` = mathjs-Ausdruck, muss boolesch sein). Muster: `template/examples/pythagoras-hypotenuse-berechnen.json`, `template/examples/lgs-zahlenpaar-handwritten.json`. Stufen-Typ ändern + `--force` hält die Keys stabil, solange Anzahl/Reihenfolge der Stufen gleich bleiben. Ziel aktuell: 20 Aufgaben pro Subthema, gespeichert in der DB (keine Live-Generierung).
- Beim Überschreiben einer Generator-Datei (`--force`) bleiben die Keys gleich; Keys anderer Dateien desselben Subthemas werden fortgezählt.

## Agenten & Abläufe

- **Nach jeder Aufgaben-Generierung oder Änderung in `drafts/exercises/` immer `math-checker`.** Importiert wird nur, was er FREIGEGEBEN hat.
- **Hinweise des `math-checker`, dass etwas zu schwer für die Stufe ist, werden immer umgesetzt** – auch wenn er sie nicht als Warnung führt (Wunsch des Users). „Leicht“ heißt auch leichte, im Kopf nachrechenbare Zahlen.
- Fehlt ein Subthema für neue Aufgaben → zuerst `curriculum-researcher`.
- Schema-Änderungen → Skill `supabase-migration`.
- Videos → Agent `math-video-producer` (läuft im Hintergrund, nutzt die Skills `create-math-video` (16:9) und `create-math-short` (9:16); Short ohne Merksatz); Arbeitsverzeichnis `video/`, Keys nur in `video/.env`.
- `marketing`, `responder`, `buchhalter` sind Entwürfe (offene Punkte in `docs/TODO.md`), nur auf ausdrückliche Anfrage nutzen.
- Code-Arbeit: globale devflow-Agenten (`planner` → `implementer` → `tester` → `reviewer`).

## Regeln

- Nur der **Publishable Key** (`sb_publishable_…`) gehört in `VITE_*`-Variablen; Secret-/`service_role`-Key nie ins Frontend oder in Commits (nur lokal für Import-Scripts).
- Nutzer sind überwiegend minderjährig: Datensparsamkeit, keine Tracking-Tools ohne Rückfrage; Nutzerdaten-Tabellen mit `on delete cascade` auf `auth.users` (DSGVO-Löschung).
- UI-Texte Deutsch, Du-Form, echte Umlaute. Code und Bezeichner Englisch.
- Design: `docs/design/design-plan.md` (Karopapier mit Korrekturrand, hell = Papier, dunkel = Tafel). Tokens in `src/index.css`, Bausteine `src/components/paper/` (`GridPaper`, `MarginNote`, `StatusMark`) und `src/components/layout/` (`PageShell`, `AppHeader`, `PublicHeader`, `ThemeToggle`). Fließtext Atkinson Hyperlegible Next, Überschriften/Randnotizen Recursive Casual (`casual`-Utility). Status nie nur über Farbe (Icon + Text). Button-Links über `buttonClass()` (`src/lib/buttonClass.ts`), Touch-Ziele ≥ 44 px. Theme-Klasse `dark` setzt das Inline-Script in `index.html` vor dem Rendern; Umschalter/Speicherung in `src/lib/theme.ts`.
- Mathe immer über die `Formula`-Komponente (`src/components/math/Formula.tsx`) rendern, nicht `katex` direkt.

## Fallstricke

- TypeScript 7: `baseUrl` existiert nicht mehr – Pfad-Alias `@/*` nur über `paths`.
- Kein Docker → kein lokales Supabase. Die Supabase CLI zielt standardmäßig auf **lokal** – für das Cloud-Projekt immer `--remote` (in `db:push`/`db:types` schon drin; auch bei `db query`, `db advisors`, `config push`). Agent-Läufe brauchen für Schreibzugriffe `--yes`, für reine Abfragen `--read-only`.
- Nach jeder Migration: `npm run db:types` und `npx supabase db advisors --remote` (erwartet und gewollt: „Leaked Password Protection“ – kein Passwort-Login; „authenticated can execute SECURITY DEFINER“ für `submit_answer`/`get_hint`/`start_exam`/`submit_exam_answer`/`finish_exam` – das sind die öffentlichen RPCs; „anonymous sign-ins“ – solange Login deaktiviert ist. Alles andere beheben).
- `src/types/database.ts` ist generiert – nicht von Hand ändern.
- Auth-Einstellungen (Site-URL, Redirects, OTP) liegen in `supabase/config.toml` → `npx supabase config push`. Vorher Diff lesen: Werte, die lokal nur Defaults sind, überschreiben sonst Remote-Einstellungen.
- Advisor `grading_requests`: Tabelle mit RLS ohne Policy (nur Service-Role) – der Advisor meldet dazu nichts (19.11.2026 geprüft); falls später „RLS enabled, no policy“ erscheint, ist das gewollt.
- Edge Function `grade-handwriting`: Deploy mit `npx supabase functions deploy grade-handwriting --yes`; Secrets setzt der User selbst (`GEMINI_API_KEY`, optional `GEMINI_MODEL` – Default `gemini-3.1-flash-lite`, `GRADING_PROVIDER`). **MVP mit Gemini Developer API – vertraglich nicht für Dienste mit Minderjährigen zulässig, Umstellung vor Go-Live** (siehe `docs/TODO.md` Etappe C). Tests der Logik laufen in Vitest (`supabase/functions/_shared/*.test.ts`); die Function selbst (`index.ts`) wird nicht von `tsc` geprüft.
- Windows-Checkout mit `core.autocrlf`: `.prettierrc.json` setzt `endOfLine: auto`, sonst meldet `format:check` jede Datei. Dateien mit Backslashes (LaTeX) nicht per Bash-Heredoc schreiben (Backslashes gehen verloren).
- Free-Tier mit Standard-SMTP: nur ~2 Mails/h und **keine eigenen Mail-Templates** → Standard-Mail enthält nur den Link, keinen 6-stelligen Code. Code-Login erst mit eigenem SMTP (z.B. Resend) + Template `supabase/templates/magic_link.html` (in `config.toml` auskommentiert).
- `npm audit` meldet `picomatch` in vite/vitest (nur Dev-Toolchain); kein `audit fix --force`.
- Video-Skills: Pfade relativ zu `video/`; Umlaute in Dateinamen vermeiden (`safe_thema`).
- `LandingPage` und alles, was sie importiert, darf weder Supabase/Auth noch `window`/`import.meta.env` nutzen und muss auf Server und Client identisch rendern – sonst bricht der Prerender bzw. die Hydration.
- `vite preview` kennt den `spa.html`-Rewrite nicht (liefert für alle Routen die Landing aus) – Routing-Verhalten nur auf Vercel-Previews prüfen.
- Neue öffentliche Seiten in `public/sitemap.xml` eintragen; geschützte Routen in `public/robots.txt` ausschließen.
