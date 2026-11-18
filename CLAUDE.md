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
npm run db:new <name> | db:push | db:types    # Supabase, siehe Skill supabase-migration
```

## Architektur

- **SPA ohne eigenes Backend**: Vite + React 19 + React Router, Daten über `@supabase/supabase-js` + TanStack Query. Sicherheit ausschließlich über **RLS** – darum Skill `supabase-migration` bei jeder Schema-Änderung.
- `src/features/<feature>/` feature-basiert; `src/components/ui/` ist shadcn-generiert (per `npx shadcn@latest add …`, nicht von Hand umbauen, von oxlint ausgenommen).
- `src/features/exercises/schema.ts` und `src/features/curriculum/schema.ts` sind die **einzige Quelle** für das Aufgaben- und Themenformat – genutzt von App, Validierungs-Script, Import und Agenten. Format ändern = dort ändern.
- Datenmodell: Themen/Subthemen global; Zuordnung zu `(Bundesland, Schulform, Klasse)` als Placements; Schwierigkeit pro Placement.
- Diagramme werden als Daten gespeichert (`diagramSchema`), nicht als Bilder.
- Auth: Google OAuth + E-Mail-OTP (6-stelliger Code, PKCE). Kein Passwort-Login.
- `video/` ist eine Python-Pipeline (Manim, ElevenLabs, ffmpeg, Conda-Env `mathtutor`), unabhängig vom Web-Stack. Kopie aus `math-tutor-videos`.
- `research/curriculum/` enthält recherchierte Lehrplandaten (u.a. NRW Gymnasium) als Ausgangsbasis.

## Aufgaben-Pipeline

```
curriculum-researcher → drafts/curriculum/*.json
exercise-author       → drafts/exercises/*.json
math-checker          → Bericht (FREIGEGEBEN / NICHT FREIGEGEBEN)
Import-Script         → Supabase, status = 'review'   (noch nicht gebaut)
Admin-Ansicht         → review → published → archived (noch nicht gebaut)
```

- Aufgaben werden nie gelöscht, nur archiviert (Schülerantworten referenzieren sie).
- Eigene Aufgaben nach Vorbild von Schulbuchaufgaben – **nie übernehmen**, Regeln in `.claude/agents/exercise-author.md`.

## Agenten & Abläufe

- **Nach jeder Aufgaben-Generierung oder Änderung in `drafts/exercises/` immer `math-checker`.** Importiert wird nur, was er FREIGEGEBEN hat.
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
- Kein Docker → kein lokales Supabase; `db:push` geht gegen das Cloud-Dev-Projekt.
- `src/types/database.ts` ist generiert (`npm run db:types`), aktuell ein Platzhalter bis zum Supabase-Link.
- Auth-Einstellungen (Site-URL, Redirects, OTP) liegen in `supabase/config.toml` → `npx supabase config push`. Vorher Diff lesen: Werte, die lokal nur Defaults sind, überschreiben sonst Remote-Einstellungen.
- Free-Tier mit Standard-SMTP: nur ~2 Mails/h und **keine eigenen Mail-Templates** → Standard-Mail enthält nur den Link, keinen 6-stelligen Code. Code-Login erst mit eigenem SMTP (z.B. Resend) + Template `supabase/templates/magic_link.html` (in `config.toml` auskommentiert).
- `npm audit` meldet `picomatch` in vite/vitest (nur Dev-Toolchain); kein `audit fix --force`.
- Video-Skills: Pfade relativ zu `video/`; Umlaute in Dateinamen vermeiden (`safe_thema`).
