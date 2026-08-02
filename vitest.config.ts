import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Resolve @kwatlp/* to each package's source so the suite runs without a prior
// build (and cross-package imports pick up live changes).
const pkgSrc = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@kwatlp/schema": pkgSrc("schema"),
      "@kwatlp/scanner": pkgSrc("scanner"),
      "@kwatlp/renderer": pkgSrc("renderer"),
    },
  },
});
