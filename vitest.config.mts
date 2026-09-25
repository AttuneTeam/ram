import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    globals: true,
    environment: "node",
    // Pure logic, colocated beside its source.
    include: ["lib/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
