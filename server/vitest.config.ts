import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Each test file gets an isolated in-memory / temp DB, so run files in
    // parallel but tests within a file sequentially.
    pool: "threads",
    globals: false,
    clearMocks: true,
  },
});
