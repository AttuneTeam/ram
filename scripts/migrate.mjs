// Applies db/migrations/*.sql in filename order, each once, each in its own
// transaction. Applied files are recorded in schema_migrations.
//
//   DATABASE_URL=... node scripts/migrate.mjs
//
// Use Neon's direct (non-pooled) connection string here.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const dir = fileURLToPath(new URL("../db/migrations/", import.meta.url));
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;
  const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(dir + file, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`applied ${file}`);
    count++;
  }
  console.log(count ? `${count} migration(s) applied` : "up to date");
} finally {
  await sql.end();
}
