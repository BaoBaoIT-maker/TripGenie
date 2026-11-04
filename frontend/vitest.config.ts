import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(__dirname, "../test/frontend/setup.ts")],
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
    dedupe: ["@tanstack/react-query", "sonner", "react", "react-dom"],
  },
  plugins: [
    {
      name: "resolve-frontend-node-modules",
      async resolveId(id, importer) {
        if (
          !id.startsWith(".") &&
          !id.startsWith("/") &&
          !id.startsWith("@/") &&
          !path.isAbsolute(id)
        ) {
          if (importer && !importer.startsWith(path.resolve(__dirname))) {
            return this.resolve(id, path.resolve(__dirname, "package.json"), {
              skipSelf: true,
            });
          }
        }
        return null;
      },
    },
  ],
});

