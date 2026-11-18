# Mathe-Training

Lern-Web-App für Mathe-Nachhilfe (Klasse 5–13): Schüler üben interaktiv, Aufgaben liegen in Supabase.

**Stack:** Vite · React 19 · TypeScript · Tailwind v4 + shadcn/ui · KaTeX · TanStack Query · React Router · Supabase (Postgres, Auth) · Vercel

## Setup

```bash
npm install
cp .env.example .env.local   # Supabase URL + anon key eintragen
npm run dev                  # http://localhost:5173
```

## Befehle

| Befehl                  | Zweck                                          |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | Dev-Server                                     |
| `npm run build`         | Typecheck + Production-Build                   |
| `npm test`              | Vitest (einmalig) · `npm run test:watch`       |
| `npm run lint`          | oxlint                                         |
| `npm run format`        | Prettier                                       |
| `npm run db:new <name>` | Neue Supabase-Migration                        |
| `npm run db:push`       | Migrationen auf verlinktes Projekt anwenden    |
| `npm run db:types`      | DB-Typen nach `src/types/database.ts` erzeugen |

## Supabase verbinden

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```

Auth: Google OAuth + E-Mail-OTP (6-stelliger Code). Details zur Einrichtung siehe `CLAUDE.md`.

## Deployment

Vercel (`vercel.json` enthält den SPA-Rewrite). Env-Variablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` im Vercel-Projekt setzen.
