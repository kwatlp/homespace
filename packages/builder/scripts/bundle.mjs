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
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
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

/**
 * Build the Builder *page* into the docs homespace: `docs/static/` is copied
 * verbatim to the site root, so this lands at `/builder/` when the docs are
 * built (dogfooding, TDD §15.1). Minified, because it is a committed artifact.
 *
 * `iife`, not `esm`: a module script is fetched under CORS rules, and a page
 * opened from `file://` has no origin to satisfy, so every browser refuses it.
 * The Builder is a page you are meant to be able to download and double-click,
 * so it ships as a classic script (request `internal-docs/003`, item 4).
 */
export async function bundlePage(outdir) {
  await mkdir(outdir, { recursive: true });
  for (const asset of ["index.html", "builder.css"]) {
    await copyFile(here(`../page/${asset}`), join(outdir, asset));
  }
  return build({
    entryPoints: [here("../src/ui/main.ts")],
    outfile: join(outdir, "builder.js"),
    bundle: true,
    format: "iife",
    platform: "neutral",
    conditions: ["module"],
    mainFields: ["module", "main"],
    target: ["es2022"],
    alias: BUNDLE_ALIASES,
    external: ["sharp"],
    minify: true,
    logLevel: "silent",
    metafile: true,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [outfile] = process.argv.slice(2);
  if (outfile !== undefined) {
    const result = await bundleBuilder(outfile);
    const bytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0;
    console.log(`bundled → ${outfile} (${Math.round(bytes / 1024)} kB)`);
  } else {
    const library = here("../dist-browser/homespace-build.js");
    const lib = await bundleBuilder(library);
    console.log(`bundled → ${library} (${Math.round(size(lib) / 1024)} kB)`);

    const page = here("../../../docs/static/builder");
    const built = await bundlePage(page);
    console.log(`bundled → ${page}/builder.js (${Math.round(size(built) / 1024)} kB, minified)`);
  }
}

function size(result) {
  return Object.values(result.metafile.outputs)[0]?.bytes ?? 0;
}
