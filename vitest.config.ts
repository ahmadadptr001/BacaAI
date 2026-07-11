import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Only run our unit tests; keep node_modules out.
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
