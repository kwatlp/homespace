// Bundle the browser build path into a single self-contained ES module.
//
// The bundle must be free of Node built-ins: the Builder is a static page with
// zero external requests (TDD §15.1). `node:path` is replaced by our POSIX
// implementation — an in-memory homespace is always POSIX — and `node:fs` /
// `node:crypto` by stubs that throw, because nothing in the browser path calls
// them. Package specifiers resolve to package *sources* so the bundle can never
// be stale relative to the tests.
//
// Usage: node scripts/bundle.mjs [outfile]
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export const BUNDLE_ALIASES = {
  "homespace-schema": here("../../schema/src/index.ts"),
  "homespace-scanner": here("../../scanner/src/index.ts"),
  "homespace-renderer": here("../../renderer/src/index.ts"),
  "node:path": here("../src/shims/path.ts"),
  path: here("../src/shims/path.ts"),
  "node:fs/promises": here("../src/shims/fs.ts"),
  "node:crypto": here("../src/shims/crypto.ts"),
};

/** Build the browser bundle; returns esbuild's result. */
export async function bundleBuilder(outfile) {
  return build({
    entryPoints: [here("../src/index.ts")],
    outfile,
    bundle: true,
    format: "esm",
    // "neutral" rather than "browser" so the *browser* export condition is not
    // applied: some markdown dependencies ship a DOM variant that decodes
    // entities through `document.createElement`. That is different code from
    // the one the CLI runs, and this build must be byte-identical to it
    // (TDD §15.2). Resolving the plain ESM entries matches Node exactly — and
    // keeps the bundle importable in Node, which is how the golden test
    // compares the two. Node built-ins are aliased away below; the test
    // asserts none survive.
    platform: "neutral",
    conditions: ["module"],
    mainFields: ["module", "main"],
    target: ["es2022"],
    alias: BUNDLE_ALIASES,
    // `sharp` is loaded through a variable specifier so a missing optional
    // dependency degrades gracefully; keep esbuild from trying to resolve it.
    external: ["sharp"],
    logLevel: "silent",
    metafile: true,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outfile = process.argv[2] ?? here("../dist-browser/homespace-build.js");
  const result = await bundleBuilder(outfile);
  const bytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0;
  console.log(`bundled → ${outfile} (${Math.round(bytes / 1024)} kB)`);
}
