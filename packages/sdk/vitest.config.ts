import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "dist/",
        "src/generated/",
        "**/*.config.ts",
      ],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
