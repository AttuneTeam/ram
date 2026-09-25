# Architecture

Ram is a personal activity tracker in the style of a contribution graph. Each column is a
week, each square a day. You log what you did on a day under a category (Exercise, Reading, …);
each category has a colour, and the shade shows how much.

There are no accounts. A **workspace** lives at `/w/<slug>` and is shared by sharing the link,
optionally locked with a 4-digit PIN.

---

## Tech stack

Mirrors Attune: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, shadcn/ui on
`@base-ui/react` (not Radix), Supabase Postgres, Zod v4, Vitest, sonner, lucide-react.

---

## Access model — read before touching data code

| Rule | Where |
|---|---|
| The browser never talks to Supabase. All reads/writes go through the Next.js server with the **service-role key**. | `lib/supabase/admin.ts` |
| RLS is enabled on every table with **no policies**, and all grants are revoked from `anon`/`authenticated`. A leaked anon key reads nothing. | `supabase/migrations/001_schema.sql` |
| Every server action starts with `requireWorkspace(slug)`, which checks the slug exists and, if a PIN is set, that the request carries a valid access cookie. Queries are then also filtered by `workspace_id`. | `lib/workspace.ts`, `app/w/[slug]/actions.ts` |
| An entry's category must belong to the same workspace. That's enforced by a composite FK, not just app code. | migration 001 |
| Slugs are 14 chars from a 57-symbol alphabet (~82 bits). For a PIN-less workspace, the slug is the only secret. | `lib/security.ts` |
| PINs are scrypt-hashed. 5 wrong attempts lock the workspace for 15 minutes. | `unlockWorkspace` |
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
  workspace.ts              Server-only: load workspace, access check, row mappers
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
npx supabase start   # Docker; applies supabase/migrations
cp .env.example .env.local   # fill from `npx supabase status`
npm run dev
```

## Deploy

- `main` → GitHub Action runs `supabase db push`, then triggers the Vercel deploy hook
  (Vercel's own git deploys are disabled in `vercel.json`, same as Attune).
- Vercel env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCESS_COOKIE_SECRET`.
- GitHub secrets (environment `production`): `SUPABASE_DB_URL`, `VERCEL_DEPLOY_HOOK_URL`.
