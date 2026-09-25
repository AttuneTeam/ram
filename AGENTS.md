<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) before changing anything under `lib/workspace.ts`,
`lib/security.ts`, `app/**/actions.ts` or `db/migrations/`. It records the access model
(slug + optional PIN, server-only database access) that every server action depends on.
