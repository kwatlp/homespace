import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Resolve @homespace/* to each package's source so the suite runs without a prior
// build (and cross-package imports pick up live changes).
const pkgSrc = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@homespace/schema": pkgSrc("schema"),
      "@homespace/scanner": pkgSrc("scanner"),
      "@homespace/renderer": pkgSrc("renderer"),
      "@homespace/cli": pkgSrc("cli"),
    },
  },
});
