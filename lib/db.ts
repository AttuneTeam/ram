import "server-only";
import postgres from "postgres";

let client: postgres.Sql | null = null;

/**
 * Shared Postgres client (Neon in production, docker locally). Created lazily
 * so env is read at request time, and reused across requests in a warm function.
 */
export function db(): postgres.Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  client = postgres(url, {
    // Neon's pooler runs PgBouncer in transaction mode, which can't hold
    // named prepared statements between queries.
    prepare: false,
    max: 5,
    idle_timeout: 20,
    types: {
      // Keep `date` columns as "YYYY-MM-DD" strings. Parsing them into JS
      // Dates would shift days across timezones.
      date: {
        to: 1082,
        from: [1082],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
    },
  });
  return client;
}

/** Postgres error codes the actions translate into user-facing messages. */
export const UNIQUE_VIOLATION = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";

export function pgCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String(err.code) : undefined;
}
