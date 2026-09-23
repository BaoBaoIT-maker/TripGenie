import { defineConfig } from "vitest/config";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

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
  },
  plugins: [
    {
      name: "resolve-frontend-node-modules",
      resolveId(id) {
        if (!id.startsWith(".") && !id.startsWith("/") && !id.startsWith("@/") && !path.isAbsolute(id)) {
          try {
            return require.resolve(id, { paths: [path.resolve(__dirname, "node_modules")] });
          } catch {
            return null;
          }
        }
        return null;
      },
    },
  ],
});

