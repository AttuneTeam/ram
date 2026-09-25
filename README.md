# Ram

A year of small things, one square at a time.

Log what you did each day (a workout, a chapter, a walk) on a contribution-style grid. Each
category has its own colour, and the more you did, the darker the square. There are no accounts:
you create a workspace, get a private link, and can optionally lock it with a 4-digit PIN.

- Click any day to log, edit or delete entries
- Unlimited categories, each with a colour and an optional unit (min, pages, km…)
- Optional month / year dividers, Monday or Sunday week start
- Stats drawer: current and longest streak, days done vs missed, totals, last 12 months
- Light and dark themes, keyboard navigation (arrow keys move between days)

See [ARCHITECTURE.md](ARCHITECTURE.md) for how it fits together and the security model.

## Getting started

```bash
npm install
npm run db:up               # local Postgres in Docker
cp .env.example .env.local  # DATABASE_URL=postgres://ram:ram@127.0.0.1:54340/ram
npm run db:migrate
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest (pure logic in `lib/`) |
| `npm run check` | Lint + type check + tests |
| `npm run db:migrate` | Apply new files in `db/migrations/` |
| `npm run db:reset` | Recreate the local database from migrations |
