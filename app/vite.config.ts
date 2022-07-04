/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    root: __dirname,
    include: ["tests/**/*.spec.ts"],
    setupFiles: ["tests/setup.ts"],
    minThreads: 1,
    maxThreads: 1,
    testTimeout: 120 * 1000,
  },
});
