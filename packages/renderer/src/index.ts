/**
 * `@kwatlp/renderer` — a pure function of `(catalog, nodeManifest, themeDir,
 * staticDir)` that produces a `dist/` of static HTML + CSS + minimal vanilla
 * JS. No framework, no bundler, and no external request in the output; it never
 * walks the filesystem outside its declared inputs and outputs.
 *
 * Scaffold only (TDD §11, WO-0). The renderer core lands in WO-3, where the
 * offline-budget gate (§10.2) goes live. See `internal-docs/KwatlpTDD.md` §6.
 */

/** Package identifier — placeholder until WO-3 lands the real surface. */
export const PACKAGE_NAME = "@kwatlp/renderer";
