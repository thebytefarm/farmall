import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      all: true,
      exclude: ["src/**/*.test.ts"],
      include: ["src/**/*.ts"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    include: ["src/**/*.test.ts"],
  },
});
