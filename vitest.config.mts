import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: ".vitest-cache/vite",
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
    exclude: [
      "**/e2e/**",
      "**/tests/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/node_modules/**",
    ],
  },
});
