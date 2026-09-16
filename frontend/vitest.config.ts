import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["../test/frontend/setup.ts"],
    globals: true,
    include: ["../test/frontend/**/*.{test,spec}.{ts,tsx}"],
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
