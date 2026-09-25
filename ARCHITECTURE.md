# Architecture

Ram is a personal activity tracker in the style of a contribution graph. Each column is a
week, each square a day. You log what you did on a day under a category (Exercise, Reading, …);
each category has a colour, and the shade shows how much.

There are no accounts. A **workspace** lives at `/w/<slug>` and is shared by sharing the link,
optionally locked with a 4-digit PIN.

---

## Tech stack

Mirrors Attune: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, shadcn/ui on
`@base-ui/react` (not Radix), Postgres on **Neon** via the `postgres` driver, Zod v4, Vitest, sonner, lucide-react.

---

## Access model — read before touching data code

| Rule | Where |
|---|---|
| The browser never talks to the database. Only the Next.js server holds `DATABASE_URL`, and it is never `NEXT_PUBLIC_`. There's no public data API to lock down. | `lib/db.ts` |
| Every server action starts with `requireWorkspace(slug)`, which checks the slug exists and, if a PIN is set, that the request carries a valid access cookie. Queries are then also filtered by `workspace_id`. | `lib/workspace.ts`, `app/w/[slug]/actions.ts` |
| An entry's category must belong to the same workspace. That's enforced by a composite FK, not just app code. | `db/migrations/001_schema.sql` |
| Slugs are 14 chars from a 57-symbol alphabet (~82 bits). For a PIN-less workspace, the slug is the only secret. | `lib/security.ts` |
| PINs are scrypt-hashed. 5 wrong attempts lock the workspace for 15 minutes. The counter is updated in one atomic statement, so parallel guesses can't get around it. | `unlockWorkspace` |
| The access cookie is an HMAC over `slug + pin_hash`, so changing or removing the PIN invalidates every issued cookie. | `lib/security.ts` |
| A locked workspace's name is not revealed in the page title or metadata. | `app/w/[slug]/page.tsx` |

Server actions return `{ ok, data } | { ok: false, error }` rather than throwing, because
Next.js masks thrown errors in production and the UI needs the message.

---

## File map

```
app/
  page.tsx                  Landing + create-workspace form + "opened on this device"
  actions.ts                createWorkspace (seeds Exercise + Reading categories)
  w/[slug]/page.tsx         Loads workspace; renders PinGate or WorkspaceApp
  w/[slug]/actions.ts       unlock, setPin, settings, category + entry CRUD

components/
  WorkspaceApp.tsx          Client state owner: filters, dialogs, optimistic updates
  ActivityGrid.tsx          The heatmap: horizontal scroll, single floating tooltip, arrow-key nav
  DayDialog.tsx             Log / edit / delete entries for a day
  CategoryDialog.tsx        Create / edit / delete a category (name, colour, unit)
  SettingsDialog.tsx        Name, dividers, week start, categories, PIN
  StatsSheet.tsx            Side drawer: streaks, done vs missed, monthly chart, table
  PinGate.tsx               4-digit PIN entry

lib/
  dates.ts                  ISO-day helpers (UTC arithmetic, no TZ drift)
  grid.ts                   Weeks → columns → segments (month/year dividers)
  intensity.ts              Entries → shade level 0–4 per day
  stats.ts                  Streaks, missed days, monthly buckets
  security.ts               Slugs, PIN hashing, access tokens
  db.ts                     Server-only Postgres client (pooler-safe, dates kept as strings)
  workspace.ts              Server-only: load workspace, access check, row mappers

db/migrations/              Plain SQL, applied in order by scripts/migrate.mjs
  palette.ts                Validated category swatches
  useToday.ts               Viewer-local "today" (client only)
```

---

## How shading works

- **One category selected:** a day's value is its summed quantity (e.g. minutes). If the
  category never records quantities, it's the number of entries.
- **All:** the value is the number of entries, coloured by the category logged most that day.
- Values map to 4 levels against the **90th percentile** of non-zero days, not the max, so one
  outlier doesn't wash the rest out. Colour is `color-mix()` of the category colour into
  `--cell-empty`, so it works in both themes.

## Why the grid renders client-only

"Today" depends on the viewer's timezone, which the server can't know. `useToday()` returns
null during SSR, so the grid mounts on the client to avoid a hydration mismatch.

## Dividers

With `month` or `year` dividers, a week that straddles the boundary appears in both segments,
with the other segment's days blanked. This keeps every segment a clean rectangle.

---

## Local development

```bash
npm install
npm run db:up                # Postgres 17 in Docker on :54340
cp .env.example .env.local   # DATABASE_URL=postgres://ram:ram@127.0.0.1:54340/ram
npm run db:migrate
npm run dev
```

## Deploy

- `main` → GitHub Action runs `scripts/migrate.mjs` against Neon, then triggers the Vercel
  deploy hook (Vercel's own git deploys are disabled in `vercel.json`, same as Attune).
  Migrations are immutable once applied: add a new numbered file, and keep it additive.
- Vercel env: `DATABASE_URL` (Neon **pooled** string), `ACCESS_COOKIE_SECRET`.
- GitHub secrets (environment `production`): `DATABASE_URL_UNPOOLED` (Neon direct string),
  `VERCEL_DEPLOY_HOOK_URL`.
