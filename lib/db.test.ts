vi.mock("server-only", () => ({}));
import { databaseUrl } from "./db";

describe("databaseUrl", () => {
  it("prefers the Neon integration's pooled variable", () => {
    expect(databaseUrl({ DATABASE_URL_DATABASE_URL: "postgres://neon", DATABASE_URL: "postgres://local" })).toBe("postgres://neon");
  });

  it("falls back to DATABASE_URL for local development", () => {
    expect(databaseUrl({ DATABASE_URL: "postgres://local" })).toBe("postgres://local");
  });

  it("skips empty values instead of connecting to nothing", () => {
    expect(databaseUrl({ DATABASE_URL_DATABASE_URL: "postgres://neon", DATABASE_URL: "" })).toBe("postgres://neon");
    expect(databaseUrl({ DATABASE_URL_DATABASE_URL: " ", DATABASE_URL: "postgres://local" })).toBe("postgres://local");
    expect(databaseUrl({})).toBeUndefined();
  });
});
